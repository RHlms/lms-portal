const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

const INTAKE_PIPELINE_ID = 'Zkblq5FENcSyXWKX5jZw';
const WORKING_PIPELINE_ID = 'I3jlj4eYesOL3niHBXD6';
const FS_SUBMITTER_EMAIL_FIELD_ID = '41En9NacCj60yb7ykcTV';

// Opportunity-level custom field ID for seller_portal_link
// Set to null until confirmed from logs — will fall back to URL scan
const SELLER_PORTAL_LINK_FIELD_ID = null;

const STAGE_ID_MAP = {
  '51ff778c-a7ca-4af5-8840-45e5c9fdaabe': { label: 'Seller Intake', status: 'active' }
};

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

function getStageInfo(stageName, stageId) {
  if (stageId && STAGE_ID_MAP[stageId]) return STAGE_ID_MAP[stageId];
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

// Extract value from GHL customFields array by field ID (primary) or key names (fallback)
function getFieldValue(fields, { id, keys } = {}) {
  const field = fields.find(f => {
    if (id && f.id === id) return true;
    if (keys) {
      return keys.some(k =>
        f.key === k ||
        f.fieldKey === `contact.${k}` ||
        f.fieldKey === `opportunity.${k}` ||
        f.fieldKey === k
      );
    }
    return false;
  });
  if (!field) return null;
  return field.value ?? field.fieldValue ?? field.fieldValueArray?.[0] ?? null;
}

// Scan all fields for a value that looks like the portal URL
function findPortalUrlByValue(fields) {
  for (const f of fields) {
    const val = f.value ?? f.fieldValue ?? f.fieldValueArray?.[0] ?? null;
    if (val && typeof val === 'string' && val.includes('documents.shortsalestart.com/file/')) {
      console.log(`Found portal URL in field ID: ${f.id} => ${val}`);
      return val;
    }
  }
  return null;
}

async function fetchStageIdMap() {
  const stageIdMap = { ...STAGE_ID_MAP };
  try {
    const pRes = await fetch(
      `${GHL_API_BASE}/opportunities/pipelines?locationId=${GHL_LOCATION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json'
        }
      }
    );
    if (pRes.ok) {
      const pData = await pRes.json();
      const pipelines = pData.pipelines || [];
      pipelines.forEach(pipeline => {
        (pipeline.stages || []).forEach(s => {
          if (s.id && s.name) {
            stageIdMap[s.id] = getStageInfo(s.name);
          }
        });
      });
      console.log('Stage ID map built with', Object.keys(stageIdMap).length, 'stages');
    } else {
      console.error('Pipeline fetch failed:', pRes.status);
    }
  } catch (e) {
    console.error('Stage map fetch error:', e.message);
  }
  return stageIdMap;
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
      return res.status(401).json({ error: 'Invalid or expired link. Please request a new one.' });
    }

    const contactData = await contactRes.json();
    const contact = contactData.contact || contactData;
    const customFields = contact.customFields || [];

    const tokenField = customFields.find(f =>
      f.id === 'f2pXGEfkPAQ5y1anxDvJ' ||
      f.key === 'magic_link_token' ||
      f.fieldKey === 'contact.magic_link_token'
    );

    const storedToken = tokenField
      ? (tokenField.value ?? tokenField.fieldValue ?? tokenField.fieldValueArray?.[0] ?? '')
      : '';

    if (!storedToken || storedToken !== token) {
      return res.status(401).json({ error: 'Invalid or expired link. Please request a new one.' });
    }

    const expiryField = customFields.find(f =>
      f.id === 'vMe7FP4EofPYZ0nu1FhO' ||
      f.key === 'portal_login_expiry' ||
      f.fieldKey === 'contact.portal_login_expiry'
    );
    const expiry = expiryField
      ? parseInt(expiryField.value ?? expiryField.fieldValue ?? '0')
      : 0;

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

    const agentEmail = (contact.email || '').toLowerCase();
    console.log('Agent email:', agentEmail);

    const [stageIdMap, intakeRes, workingRes] = await Promise.all([
      fetchStageIdMap(),
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

    const BATCH_SIZE = 5;
    const matchedOpps = [];

    for (let i = 0; i < allOpps.length; i += BATCH_SIZE) {
      const batch = allOpps.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map(async opp => {
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

        const submitterEmail = getFieldValue(sellerFields, {
          id: FS_SUBMITTER_EMAIL_FIELD_ID,
          keys: ['fs_submitter_email']
        }) || '';

        if (submitterEmail.toLowerCase() !== agentEmail) return null;

        // Pull portal URL from opp custom fields
        // Try by known field ID first, then scan all field values for portal URL pattern
        const oppFields = opp.customFields || [];
        let portalUrl = SELLER_PORTAL_LINK_FIELD_ID
          ? getFieldValue(oppFields, { id: SELLER_PORTAL_LINK_FIELD_ID })
          : null;

        if (!portalUrl) {
          portalUrl = findPortalUrlByValue(oppFields);
        }

        // Dump all non-null field values on matched opp to identify field IDs
        console.log(`Matched opp: ${opp.name} | Portal URL: ${portalUrl}`);
        oppFields.forEach(f => {
          const val = f.value ?? f.fieldValue ?? f.fieldValueArray?.[0] ?? null;
          if (val) console.log(`  Field ${f.id}: ${val}`);
        });

        return { ...opp, _portalUrl: portalUrl };
      }));

      results.filter(Boolean).forEach(opp => matchedOpps.push(opp));
      if (matchedOpps.length > 0 && i > 20) break;
    }

    console.log(`Matched ${matchedOpps.length} opps for agent ${agentEmail}`);

    const files = matchedOpps.map(opp => {
      const stageId = opp.pipelineStageId || '';
      const stageInfo = stageIdMap[stageId] || getStageInfo('', stageId);
      const createdAt = opp.createdAt ? new Date(opp.createdAt) : new Date();
      const daysActive = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const isClosed = stageInfo.status === 'closed-won' || stageInfo.status === 'closed-lost';

      const oppName = opp.name || '';
      let address = oppName;
      if (oppName.includes('—')) {
        address = oppName.split('—')[0].trim();
      } else if (oppName.includes(' - ')) {
        address = oppName.split(' - ')[0].trim()
      }

      const portalUrl = opp._portalUrl || null;

      console.log('File:', address, '| Label:', stageInfo.label, '| Portal:', portalUrl);

      return {
        id: opp.id,
        name: oppName,
        address,
        stageName: stageInfo.label,
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
