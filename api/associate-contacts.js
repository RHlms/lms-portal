// api/associate-contacts.js
// Associates all file parties to the SS File custom object record in GHL
// Triggered by webhook at end of File Start workflow

const GHL_KEY = process.env.GHL_API_KEY;
const LOC_ID  = process.env.GHL_LOCATION_ID;
const BASE    = 'https://services.leadconnectorhq.com';
const OBJ_KEY = 'short_sale_files';

const hdrs = () => ({
  'Authorization': `Bearer ${GHL_KEY}`,
  'Content-Type':  'application/json',
  'Version':       '2021-07-28'
});
// CORS — remove after testing
const allowCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
};
// ── Helpers ──────────────────────────────────────────────────────────────────

async function getContactByEmail(email) {
  if (!email?.trim()) return null;
  const res  = await fetch(
    `${BASE}/contacts/?locationId=${LOC_ID}&email=${encodeURIComponent(email.trim())}`,
    { headers: hdrs() }
  );
  const data = await res.json();
  const id   = data?.contacts?.[0]?.id || null;
  console.log(`[contact] ${email} → ${id ?? 'NOT FOUND'}`);
  return id;
}

async function getSSFileId(opportunityId) {
  let page = 1;
  while (true) {
    const res  = await fetch(
      `${BASE}/v2/custom-objects/${OBJ_KEY}/records?locationId=${LOC_ID}&page=${page}&limit=100`,
      { headers: hdrs() }
    );
    const data    = await res.json();
    const records = data?.data ?? data?.records ?? [];
    if (!records.length) break;

    const match = records.find(r => {
      const p = r.properties ?? r.fields ?? {};
      return p.opportunity_id_unique === opportunityId;
    });
    if (match) {
      console.log(`[ss_file] opp ${opportunityId} → record ${match.id}`);
      return match.id;
    }
    if (!data?.meta?.nextPage) break;
    page++;
  }
  console.log(`[ss_file] opp ${opportunityId} → NOT FOUND`);
  return null;
}

async function createAssociation(ssFileId, contactId, label) {
  // ⚠️ Endpoint verified against GHL v2 custom objects API — check logs on first run
  const res  = await fetch(
    `${BASE}/v2/custom-objects/${OBJ_KEY}/records/${ssFileId}/associations`,
    {
      method:  'POST',
      headers: hdrs(),
      body:    JSON.stringify({ contactId, associationLabel: label })
    }
  );
  const data = await res.json().catch(() => ({}));
  console.log(`[assoc] ${label} (${contactId}) → ${res.status}`, JSON.stringify(data));
  return { label, contactId, status: res.status, ok: res.ok, data };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  allowCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const {
    opportunity_id,
    seller_email,
    la_email,
    cola_email,  // optional
    tc_email,    // optional
    poa_email    // optional
  } = req.body;

  console.log('[associate-contacts] payload:', JSON.stringify(req.body));

  if (!opportunity_id) {
    return res.status(400).json({ error: 'opportunity_id required' });
  }

  // 1 — Find the SS File record by opportunity_id_unique
  const ssFileId = await getSSFileId(opportunity_id);
  if (!ssFileId) {
    return res.status(404).json({ error: `No SS File for opp: ${opportunity_id}` });
  }

  // 2 — Resolve contact IDs by email (parallel)
  const [sellerId, laId, colaId, tcId, poaId] = await Promise.all([
    getContactByEmail(seller_email),
    getContactByEmail(la_email),
    getContactByEmail(cola_email),
    getContactByEmail(tc_email),
    getContactByEmail(poa_email)
  ]);

  // 3 — Build list, skip any that didn't resolve
  // ⚠️ Verify Co-Listing Agent + POA label names match exactly what's in GHL
  const queue = [
    { id: sellerId, label: 'SS Seller' },
    { id: laId,     label: 'SS Listing Agent' },
    { id: colaId,   label: 'SS Co-Listing Agent' },   // ⚠️ confirm label
    { id: tcId,     label: 'SS TC - Listing Agent' },
    { id: poaId,    label: 'SS Seller - POA' }         // ⚠️ confirm label
  ].filter(a => a.id);

  // 4 — Create all associations
  const results = await Promise.all(queue.map(a => createAssociation(ssFileId, a.id, a.label)));

  return res.status(200).json({ ssFileId, attempted: results.length, results });
}
