// api/dashboard-data.js
// Validates magic link token, returns all files for the contact

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

// Map GHL pipeline stage names to plain English
const STAGE_MAP = {
  // INTAKE pipeline
  '1 - START': { label: 'Getting Started', status: 'active' },
  '2 - SELLER SERVICE AGREEMENT': { label: 'Service Agreement', status: 'active' },
  '3 - SELLER INTAKE': { label: 'Seller Intake', status: 'active' },
  '4 - S/I/F DOCS MISSING': { label: 'Action Needed', status: 'warning' },
  '5 - 3PA': { label: 'Authorization Pending', status: 'active' },
  '6 - LENDER AUTHORIZATION': { label: 'Lender Authorization', status: 'active' },
  '7 - BUYER NEEDED': { label: 'Buyer Needed', status: 'warning' },
  '8 - OFFER INTAKE': { label: 'Offer Received', status: 'active' },
  '9 - OIF MISSING': { label: 'Action Needed', status: 'warning' },
  '10 - OFFER INTAKE (Missing OIF)': { label: 'Action Needed', status: 'warning' },
  '11 - PACKAGE COMPLETE': { label: 'Package Complete', status: 'active' },
  '12 - SATISFIED': { label: 'Ready for Lender', status: 'active' },
  // WORKING pipeline
  '1 - START - PACKAGE WORKING': { label: 'Package Working', status: 'active' },
  '2 - BUYER #2 NEEDED': { label: 'New Buyer Needed', status: 'warning' },
  '3 - START - BUYER #2': { label: 'New Buyer Intake', status: 'active' },
  '4 - PACKAGE SENT': { label: 'Package Sent', status: 'active' },
  '5 - PACKAGE - BPO': { label: 'Awaiting BPO', status: 'active' },
  '6 - BPO - IN REVIEW': { label: 'Lender Review', status: 'active' },
  '7 - NEGOTIATIONS': { label: 'Negotiations', status: 'active' },
  '8 - VALUE DISPUTE': { label: 'Value Dispute', status: 'warning' },
  '9 - APPROVAL LETTER': { label: 'Approved!', status: 'success' },
  '10 - CLOSE PENDING': { label: 'Close Pending', status: 'success' },
  '11 - CLOSED-W': { label: 'Closed — Won', status: 'closed-won' },
  'CLOSED-W': { label: 'Closed — Won', status: 'closed-won' },
  'CLOSED-L': { label: 'Closed — Lost', status: 'closed-lost' },
  'RESET': { label: 'On Hold', status: 'warning' }
};

function getStageInfo(stageName) {
  if (!stageName) return { label: 'In Progress', status: 'active' };
  const match = STAGE_MAP[stageName];
  if (match) return match;
  if (stageName.toLowerCase().includes('closed') && stageName.toLowerCase().includes('w')) {
    return { label: 'Closed — Won', status: 'closed-won' };
  }
  if (stageName.toLowerCase().includes('closed')) {
    return { label: 'Closed — Lost', status: 'closed-lost' };
  }
  return { label: stageName, status: 'active' };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token, type } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    // Search for contact with this token
    const searchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/?locationId=${GHL_LOCATION_ID}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    // Use the search endpoint with custom field filter
    const tokenSearchRes = await fetch(
      `https://services.leadconnectorhq.com/contacts/search?locationId=${GHL_LOCATION_ID}&filters[0][field]=portal_login_token&filters[0][operator]=eq&filters[0][value]=${encodeURIComponent(token)}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    let contact = null;

    if (tokenSearchRes.ok) {
      const tokenData = await tokenSearchRes.json();
      const contacts = tokenData.contacts || tokenData.data || [];
      if (contacts.length > 0) {
        contact = contacts[0];
      }
    }

    if (!contact) {
      return res.status(401).json({ error: 'Invalid or expired link. Please request a new one.' });
    }

    // Check expiry
    const customFields = contact.customFields || [];
    const expiryField = customFields.find(f => f.key === 'portal_login_expiry' || f.fieldKey === 'contact.portal_login_expiry');
    const expiry = expiryField ? parseInt(expiryField.value || expiryField.fieldValue) : 0;

    if (!expiry || Date.now() > expiry) {
      return res.status(401).json({ error: 'This link has expired. Please request a new one.' });
    }

    const contactId = contact.id;
    const email = contact.email;

    // Clear the token (single use)
    await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({
          customFields: [
            { key: 'portal_login_token', field_value: '' },
            { key: 'portal_login_expiry', field_value: '' }
          ]
        })
      }
    );

    // Get submitter email from custom fields
    const submitterEmailField = customFields.find(f =>
      f.key === 'fs_submitter_email' || f.fieldKey === 'contact.fs_submitter_email'
    );
    const submitterEmail = submitterEmailField
      ? (submitterEmailField.value || submitterEmailField.fieldValue)
      : email;

    // Fetch all opportunities for this location and filter by submitter email
    const oppsRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/search?location_id=${GHL_LOCATION_ID}&contact_id=${contactId}&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        }
      }
    );

    let opportunities = [];

    if (oppsRes.ok) {
      const oppsData = await oppsRes.json();
      opportunities = oppsData.opportunities || [];
    }

    // If agent — also search by fs_submitter_email across all opps
    if (type === 'agent' && submitterEmail) {
      const agentOppsRes = await fetch(
        `https://services.leadconnectorhq.com/opportunities/search?location_id=${GHL_LOCATION_ID}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28'
          }
        }
      );

      if (agentOppsRes.ok) {
        const agentOppsData = await agentOppsRes.json();
        const allOpps = agentOppsData.opportunities || [];

        // Filter opps where the contact has fs_submitter_email matching
        const agentOpps = allOpps.filter(opp => {
          const oppContact = opp.contact || {};
          const fields = oppContact.customFields || [];
          const emailField = fields.find(f =>
            f.key === 'fs_submitter_email' || f.fieldKey === 'contact.fs_submitter_email'
          );
          const val = emailField ? (emailField.value || emailField.fieldValue || '') : '';
          return val.toLowerCase() === submitterEmail.toLowerCase();
        });

        // Merge and deduplicate
        const seen = new Set(opportunities.map(o => o.id));
        agentOpps.forEach(o => { if (!seen.has(o.id)) opportunities.push(o); });
      }
    }

    // Format opportunities
    const files = opportunities.map(opp => {
      const stageName = opp.pipelineStage?.name || opp.status || '';
      const stageInfo = getStageInfo(stageName);
      const createdAt = opp.createdAt ? new Date(opp.createdAt) : new Date();
      const daysActive = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const isClosed = stageInfo.status === 'closed-won' || stageInfo.status === 'closed-lost';

      // Extract address from opp name (format: "123 Main St - LastName - 26")
      const nameParts = (opp.name || '').split(' - ');
      const address = nameParts[0] || opp.name || 'Unknown Address';

      // Get portal URL from opp custom fields
      const oppFields = opp.customFields || [];
      const portalField = oppFields.find(f =>
        f.key === 'seller_portal_link' || f.fieldKey === 'opportunity.seller_portal_link'
      );
      const portalUrl = portalField ? (portalField.value || portalField.fieldValue) : null;

      return {
        id: opp.id,
        name: opp.name,
        address,
        stageName,
        stageLabel: stageInfo.label,
        stageStatus: stageInfo.status,
        daysActive,
        isClosed,
        closedAt: isClosed ? opp.updatedAt : null,
        portalUrl,
        contactId: opp.contact?.id || contactId
      };
    });

    // Sort: active first, then closed by date
    files.sort((a, b) => {
      if (a.isClosed && !b.isClosed) return 1;
      if (!a.isClosed && b.isClosed) return -1;
      return b.daysActive - a.daysActive;
    });

    return res.status(200).json({
      success: true,
      contact: {
        id: contactId,
        name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
        email: contact.email,
        type: type || 'agent'
      },
      files
    });

  } catch (err) {
    console.error('Dashboard data error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
