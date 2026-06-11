const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

const STAGE_MAP = {
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

  const { token, contact: contactId, type } = req.query;

  if (!token || !contactId) {
    return res.status(400).json({ error: 'Token and contact ID required' });
  }

  try {
    const contactRes = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      }
    });

    if (!contactRes.ok) {
      const errData = await contactRes.json();
      console.error('Contact fetch failed:', JSON.stringify(errData));
      return res.status(401).json({ error: 'Invalid or expired link. Please request a new one.' });
    }

    const contactData = await contactRes.json();
    const contact = contactData.contact || contactData;
    const customFields = contact.customFields || [];

    console.log('Token from URL:', token);
    console.log('All custom field keys:', JSON.stringify(customFields.map(f => ({ key: f.key, fieldKey: f.fieldKey, id: f.id, value: f.value, fieldValue: f.fieldValue }))));

    const tokenField = customFields.find(f =>
      f.key === 'magic_link_token' ||
      f.fieldKey === 'contact.magic_link_token' ||
      f.id === 'magic_link_token'
    );

    console.log('Token field found:', JSON.stringify(tokenField));

    const storedToken = tokenField
      ? (tokenField.value ?? tokenField.fieldValue ?? tokenField.fieldValueArray?.[0] ?? '')
      : '';

    console.log('Stored token:', storedToken);
    console.log('Tokens match:', storedToken === token);

    if (!storedToken || storedToken !== token) {
      return res.status(401).json({ error: 'Invalid or expired link. Please request a new one.', debug: { storedToken: storedToken?.substring(0, 8), tokenStart: token?.substring(0, 8) } });
    }

    const expiryField = customFields.find(f =>
      f.key === 'portal_login_expiry' ||
      f.fieldKey === 'contact.portal_login_expiry' ||
      f.id === 'portal_login_expiry'
    );
    const expiry = expiryField
      ? parseInt(expiryField.value ?? expiryField.fieldValue ?? '0')
      : 0;

    console.log('Expiry:', expiry, 'Now:', Date.now(), 'Expired:', Date.now() > expiry);

    if (!expiry || Date.now() > expiry) {
      return res.status(401).json({ error: 'This link has expired. Please request a new one.' });
    }

    await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customFields: [
          { key: 'magic_link_token', field_value: '' },
          { key: 'portal_login_expiry', field_value: '' }
        ]
      })
    });

    const oppsRes = await fetch(
      `${GHL_API_BASE}/opportunities/search?location_id=${GHL_LOCATION_ID}&contact_id=${contactId}&limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json'
        }
      }
    );

    let opportunities = [];
    if (oppsRes.ok) {
      const oppsData = await oppsRes.json();
      opportunities = oppsData.opportunities || [];
    }

    const submitterEmailField = customFields.find(f =>
      f.key === 'fs_submitter_email' || f.fieldKey === 'contact.fs_submitter_email'
    );
    const submitterEmail = submitterEmailField
      ? (submitterEmailField.value ?? submitterEmailField.fieldValue ?? '')
      : contact.email;

    if (type === 'agent' && submitterEmail) {
      const agentOppsRes = await fetch(
        `${GHL_API_BASE}/opportunities/search?location_id=${GHL_LOCATION_ID}&limit=100`,
        {
          headers: {
            'Authorization': `Bearer ${GHL_API_KEY}`,
            'Version': GHL_API_VERSION,
            'Content-Type': 'application/json'
          }
        }
      );

      if (agentOppsRes.ok) {
        const agentOppsData = await agentOppsRes.json();
        const allOpps = agentOppsData.opportunities || [];
        const agentOpps = allOpps.filter(opp => {
          const fields = opp.contact?.customFields || [];
          const emailField = fields.find(f =>
            f.key === 'fs_submitter_email' || f.fieldKey === 'contact.fs_submitter_email'
          );
          const val = emailField ? (emailField.value ?? emailField.fieldValue ?? '') : '';
          return val.toLowerCase() === submitterEmail.toLowerCase();
        });
        const seen = new Set(opportunities.map(o => o.id));
        agentOpps.forEach(o => { if (!seen.has(o.id)) opportunities.push(o); });
      }
    }

    const files = opportunities.map(opp => {
      const stageName = opp.pipelineStage?.name || opp.status || '';
      const stageInfo = getStageInfo(stageName);
      const createdAt = opp.createdAt ? new Date(opp.createdAt) : new Date();
      const daysActive = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const isClosed = stageInfo.status === 'closed-won' || stageInfo.status === 'closed-lost';
      const nameParts = (opp.name || '').split(' - ');
      const address = nameParts[0] || opp.name || 'Unknown Address';
      const oppFields = opp.customFields || [];
      const portalField = oppFields.find(f =>
        f.key === 'seller_portal_link' ||
        f.fieldKey === 'opportunity.seller_portal_link'
      );
      const portalUrl = portalField ? (portalField.value ?? portalField.fieldValue ?? null) : null;

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
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
