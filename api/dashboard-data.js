const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

const INTAKE_PIPELINE_ID = 'Zkblq5FENcSyXWKX5jZw';
const WORKING_PIPELINE_ID = 'I3jlj4eYesOL3niHBXD6';

const STAGE_MAP = {
  '1 - START':                        { label: 'Seller Intake', status: 'active' },
  '2 - SELLER INTAKE - PORTAL':       { label: 'Seller Intake', status: 'active' },
  '3 - SELLER INTAKE — CHASE':        { label: 'Seller Intake', status: 'warning' },
  '4 - SELLER INTAKE — FILE REVIEW':  { label: 'Seller Intake', status: 'active' },
  '🔴 RESET STAGE🔴':                 { label: 'On Hold', status: 'warning' },
  '5 - 3PA ⚠️':                       { label: 'Third-Party Authorization', status: 'active' },
  '6 - 3PA ✅ (50)':                  { label: 'Third-Party Authorization', status: 'active' },
  '7 - NO BUYER ⚠️':                  { label: 'Buyer Needed', status: 'warning' },
  '8 - BUYER ✅ - OIF ⚠️':            { label: 'Offer Intake', status: 'active' },
  '9 - OIF ✅':                       { label: 'Offer Intake', status: 'active' },
  'CLOSED-W':                         { label: 'Closed — Won', status: 'closed-won' },
  'CLOSED-L':                         { label: 'Closed — Lost', status: 'closed-lost' }
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
  return { label: 'In Progress', status: 'active' };
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
    // Step 1: Fetch logged-in contact by ID
    const contactRes = await fetch(`${GHL_API_BASE}/contacts/${contactId}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      }
    });

    if (!contactRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired link. Please request a new one.' });
    }

    const contactData = await contactRes.json();
    const contact = contactData.contact || contactData;
    const customFields = contact.customFields || [];

    // Step 2: Validate token
    const tokenField = customFields.find(f =>
      f.key === 'magic_link_token' ||
      f.fieldKey === 'contact.magic_link_token' ||
      f.id === 'f2pXGEfkPAQ5y1anxDvJ'
    );

    const storedToken = tokenField
      ? (tokenField.value ?? tokenField.fieldValue ?? tokenField.fieldValueArray?.[0] ?? '')
      : '';

    if (!storedToken || storedToken !== token) {
      return res.status(401).json({ error: 'Invalid or expired link. Please request a new one.' });
    }

    // Step 3: Validate expiry
    const expiryField = customFields.find(f =>
      f.key === 'portal_login_expiry' ||
      f.fieldKey === 'contact.portal_login_expiry' ||
      f.id === 'vMe7FP4EofPYZ0nu1FhO'
    );
    const expiry = expiryField
      ? parseInt(expiryField.value ?? expiryField.fieldValue ?? '0')
      : 0;

    if (!expiry || Date.now() > expiry) {
      return res.status(401).json({ error: 'This link has expired. Please request a new one.' });
    }

    // Step 4: Clear token (single use)
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

    const agentEmail = (contact.email || '').toLowerCase();
    console.log('Agent email:', agentEmail);

    // Step 5: Fetch all INTAKE + WORKING opps
    const [intakeRes, workingRes] = await Promise.all([
      fetch(`${GHL_API_BASE}/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${INTAKE_PIPELINE_ID}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json'
        }
      }),
      fetch(`${GHL_API_BASE}/opportunities/search?location_id=${GHL_LOCATION_ID}&pipeline_id=${WORKING_PIPELINE_ID}&limit=100`, {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json'
        }
      })
    ]);

    let allOpps = [];
    if (intakeRes.ok) {
      const d = await intakeRes.json();
      allOpps = allOpps.concat(d.opportunities || []);
    }
    if (workingRes.ok) {
      const d = await workingRes.json();
      allOpps = allOpps.concat(d.opportunities || []);
    }

    console.log(`Total opps in both pipelines: ${allOpps.length}`);

    // Step 6: For each opp, fetch the seller contact and check fs_submitter_email
    const oppChecks = await Promise.all(allOpps.map(async opp => {
      const sellerContactId = opp.contact?.id;
      if (!sellerContactId) return null;

      const sellerRes = await fetch(`${GHL_API_BASE}/contacts/${sellerContactId}`, {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json'
        }
      });

      if (!sellerRes.ok) return null;

      const sellerData = await sellerRes.json();
      const seller = sellerData.contact || sellerData;
      const sellerFields = seller.customFields || [];

      const submitterField = sellerFields.find(f =>
        f.key === 'fs_submitter_email' ||
        f.fieldKey === 'contact.fs_submitter_email'
      );

      const submitterEmail = submitterField
        ? (submitterField.value ?? submitterField.fieldValue ?? '').toLowerCase()
        : '';

      console.log(`Opp: ${opp.name} | Submitter: ${submitterEmail}`);

      if (submitterEmail === agentEmail) {
        return opp;
      }
      return null;
    }));

    const opportunities = oppChecks.filter(Boolean);
    console.log(`Matched ${opportunities.length} opps for agent ${agentEmail}`);

    // Step 7: Format files
    const files = opportunities.map(opp => {
      const stageName = opp.pipelineStage?.name || '';
      const stageInfo = getStageInfo(stageName);
      const createdAt = opp.createdAt ? new Date(opp.createdAt) : new Date();
      const daysActive = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const isClosed = stageInfo.status === 'closed-won' || stageInfo.status === 'closed-lost';

      const oppName = opp.name || '';
      let address = oppName;
      if (oppName.includes('—')) {
        address = oppName.split('—')[0].trim();
      } else if (oppName.includes(' - ')) {
        address = oppName.split(' - ')[0].trim();
      }

      const oppFields = opp.customFields || [];
      const portalField = oppFields.find(f =>
        f.key === 'seller_portal_link' ||
        f.fieldKey === 'opportunity.seller_portal_link'
      );
      const portalUrl = portalField ? (portalField.value ?? portalField.fieldValue ?? null) : null;

      console.log('File:', address, '| Stage:', stageName, '| Label:', stageInfo.label);

      return {
        id: opp.id,
        name: oppName,
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
