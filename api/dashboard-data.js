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
    // Step 1: Fetch contact directly by ID
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

    // DEBUG
    console.log('Token from URL:', token);
    console.log('All custom field keys:', customFields.map(f => ({ key: f.key, fieldKey: f.fieldKey, id: f.id, value: f.value, fieldValue: f.fieldValue })));

    // Step 2: Validate token matches
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

    // Step 3: Validate expiry
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

    // Step 4: Clear the token (single use)
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

    // Step 5: Fetch opportunities for this contact
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

    // Step 6: If agent — also search by fs_submitter_email
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

    // Step 7: Format files
    const files = opportunities.map(opp => {
      const stageName = opp.pipelineStage?.name || opp.status || '';
      const stageInfo = getStageInfo(stageName);
      const createdAt = opp.creat
