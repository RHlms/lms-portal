
// api/offer-checklist-2.js
const GHL_KEY = process.env.GHL_API_KEY;
const BASE    = 'https://services.leadconnectorhq.com';

const hdrs = () => ({
  'Authorization': `Bearer ${GHL_KEY}`,
  'Content-Type':  'application/json',
  'Version':       '2021-07-28'
});

const FIELDS = {
  asis_contract:    { key: 'offer_docs_2_asis_contract' },
  ss_addendum:      { key: 'offer_docs_2_ss_addendum_to_asis_contract' },
  buyer_pof:        { key: 'offer_docs_2_buyer_proof_of_fundsapproval_letter' },
  mls_sheet:        { key: 'offer_docs_2_mls_sheet' },
  buyer_disclosure: { key: 'offer_docs_2_lms_buyer_disclosure' },
  misc_addenda:     { key: 'offer_docs_2_misc_addenda' },
};

function isReceived(val) {
  if (Array.isArray(val)) return val.includes('Received');
  return val === 'Received';
}

async function getOpp(oppId) {
  const res = await fetch(
    `${BASE}/opportunities/${oppId}`,
    { headers: hdrs() }
  );
  if (!res.ok) throw new Error(`GHL fetch ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.opportunity || data;
}

async function setField(oppId, fieldKey, received) {
  const res = await fetch(`${BASE}/opportunities/${oppId}`, {
    method:  'PUT',
    headers: hdrs(),
    body:    JSON.stringify({
      customFields: [{ key: fieldKey, field_value: received ? ['Received'] : [] }]
    })
  });
  return res.ok;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { opp_id } = req.query;
    if (!opp_id) return res.status(400).json({ error: 'opp_id required' });
    try {
      const opp = await getOpp(opp_id);
      const cf  = opp?.customFields ?? [];
      const status = {};
      for (const [id, def] of Object.entries(FIELDS)) {
        const field = cf.find(f =>
          f.key === def.key || f.fieldKey === def.key
        );
        const val  = field?.fieldValueArray ?? field?.fieldValue ?? field?.value ?? field?.field_value ?? [];
        status[id] = isReceived(val);
      }
      return res.status(200).json({ opp_id, status });
    } catch (err) {
      console.error('[offer-checklist-2 GET]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { opp_id, item_id, received } = req.body ?? {};
    if (!opp_id || !item_id) return res.status(400).json({ error: 'opp_id and item_id required' });
    if (!(item_id in FIELDS)) return res.status(400).json({ error: `Unknown item_id: ${item_id}` });
    try {
      const ok = await setField(opp_id, FIELDS[item_id].key, !!received);
      if (!ok) return res.status(500).json({ error: 'GHL update failed' });
      return res.status(200).json({ success: true, item_id, received: !!received });
    } catch (err) {
      console.error('[offer-checklist-2 POST]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
