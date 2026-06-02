// api/offer-checklist.js
// GET  ?opp_id=xxx        → current received status for all 7 offer docs
// POST {opp_id, item_id, received: true|false} → manually toggle a field

const GHL_KEY = process.env.GHL_API_KEY;
const BASE    = 'https://services.leadconnectorhq.com';

const hdrs = () => ({
  'Authorization': `Bearer ${GHL_KEY}`,
  'Content-Type':  'application/json',
  'Version':       '2021-07-28'
});

// Maps item_id (from offer-docs.html) → GHL opportunity field key
const FIELDS = {
  listing_agreement: 'offer_docs_listing_agreement',
  ss_addendum_asis:  'offer_docs_ss_addendum',
  mls_sheet:         'offer_docs_mls_sheet',
  asis_contract:     'offer_docs_asis_contract',
  buyer_disclosure:  'offer_docs_lms_buyer_disclosure',
  ss_addendum_la:    'offer_docs_ss_addendum_to_listing_agreement',
  proof_of_funds:    'offer_docs_buyer_proof_of_fundsapproval_letter',
};

function isReceived(val) {
  if (Array.isArray(val)) return val.includes('Received');
  return val === 'Received';
}

async function getOpp(oppId) {
  const res  = await fetch(`${BASE}/opportunities/${oppId}`, { headers: hdrs() });
  if (!res.ok) throw new Error(`GHL ${res.status}`);
  const data = await res.json();
  return data?.opportunity ?? data;
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

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { opp_id } = req.query;
    if (!opp_id) return res.status(400).json({ error: 'opp_id required' });

    try {
      const opp = await getOpp(opp_id);
      const cf  = opp?.customFields ?? [];

      const status = {};
      for (const [id, key] of Object.entries(FIELDS)) {
        const field  = cf.find(f => f.key === key || f.fieldKey === key);
        const val    = field?.fieldValue ?? field?.value ?? field?.field_value ?? [];
        status[id]   = isReceived(val);
      }

      return res.status(200).json({ opp_id, status });
    } catch (err) {
      console.error('[offer-checklist GET]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { opp_id, item_id, received } = req.body ?? {};
    if (!opp_id || !item_id) return res.status(400).json({ error: 'opp_id and item_id required' });
    if (!(item_id in FIELDS))  return res.status(400).json({ error: `Unknown item_id: ${item_id}` });

    try {
      const ok = await setField(opp_id, FIELDS[item_id], !!received);
      if (!ok) return res.status(500).json({ error: 'GHL update failed' });
      return res.status(200).json({ success: true, item_id, received: !!received });
    } catch (err) {
      console.error('[offer-checklist POST]', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
