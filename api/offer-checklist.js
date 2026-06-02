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
  listing_agreement: { key: 'offer_docs_listing_agreement',                   id: '1NgEJRm39ag7NEBkzSin' },
  ss_addendum_asis:  { key: 'offer_docs_ss_addendum',                         id: '1mjRkJ2cU1sy7ZXv7v2d' },
  mls_sheet:         { key: 'offer_docs_mls_sheet',                           id: 'F2y4Vqq9yOlRcsrp5Kvt' },
  asis_contract:     { key: 'offer_docs_asis_contract',                       id: 'ZQjModsIT01Vq1ezRUKR'  },
  buyer_disclosure:  { key: 'offer_docs_lms_buyer_disclosure',                id: 'k9MPzBHNuGA8mcbvGi9g' },
  ss_addendum_la:    { key: 'offer_docs_ss_addendum_to_listing_agreement',    id: 'FTEZyE97TwdZ4ZJ3YQvI' },
  proof_of_funds:    { key: 'offer_docs_buyer_proof_of_fundsapproval_letter', id: 'k3Y2AOEgaorsg6hteaAm' },
};

function isReceived(val) {
  if (Array.isArray(val)) return val.includes('Received');
  return val === 'Received';
}

async function getOpp(oppId) {
  const res  = await fetch(
    `${BASE}/opportunities/search?location_id=${LOC_ID}&id=${oppId}`,
    { headers: hdrs() }
  );
  if (!res.ok) throw new Error(`GHL search ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const list = data?.opportunities ?? data?.data ?? [];
  const opp  = list.find(o => o.id === oppId);
  if (!opp) throw new Error(`Opp ${oppId} not found in search results`);
  return opp;
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
for (const [id, def] of Object.entries(FIELDS)) {
  const field = cf.find(f =>
    f.id === def.id ||
    f.key === def.key ||
    f.fieldKey === def.key
  );
  const val   = field?.fieldValue ?? field?.value ?? field?.field_value ?? [];
  status[id]  = isReceived(val);
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
