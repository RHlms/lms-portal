// api/debug-fields.js
// Temporary diagnostic endpoint — delete after field IDs are confirmed.
// Hit: https://documents.shortsalestart.com/api/debug-fields

export default async function handler(req, res) {
  const GHL_API_KEY     = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  const BASE = `https://services.leadconnectorhq.com/locations/${GHL_LOCATION_ID}/customFields`;
  const HEADERS = {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };

  const results = {};

  // ── Try 1: default (no model param) ──────────────────────────────────────
  try {
    const r = await fetch(BASE, { headers: HEADERS });
    results.no_model = await r.json();
  } catch (e) {
    results.no_model_err = e.message;
  }

  // ── Try 2: model=opportunity ──────────────────────────────────────────────
  try {
    const r = await fetch(`${BASE}?model=opportunity`, { headers: HEADERS });
    results.model_opportunity = await r.json();
  } catch (e) {
    results.model_opportunity_err = e.message;
  }

  // ── Try 3: model=contact ──────────────────────────────────────────────────
  try {
    const r = await fetch(`${BASE}?model=contact`, { headers: HEADERS });
    results.model_contact = await r.json();
  } catch (e) {
    results.model_contact_err = e.message;
  }

  // ── Try 4: v2 opportunities customFields endpoint ─────────────────────────
  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/opportunities/customFields`,
      { headers: HEADERS }
    );
    results.opps_endpoint = await r.json();
  } catch (e) {
    results.opps_endpoint_err = e.message;
  }

  // ── Filter results to only show SELLER DOCS fields ────────────────────────
  // Makes the response easier to read
  const PORTAL_KEYS = ['portal_sa', 'portal_sif', 'portal_mortgage', 'portal_3pa', 'sa_signing'];

  const filtered = {};
  for (const [key, val] of Object.entries(results)) {
    if (key.endsWith('_err')) {
      filtered[key] = val;
      continue;
    }
    const fields = val?.customFields || val?.fields || val || [];
    if (!Array.isArray(fields)) {
      filtered[key] = val; // return raw if unexpected shape
      continue;
    }
    filtered[key] = {
      total_returned: fields.length,
      portal_fields: fields.filter(f =>
        PORTAL_KEYS.some(k => (f.fieldKey || f.key || f.name || '').toLowerCase().includes(k))
      ),
      all_fields: fields.map(f => ({
        id:       f.id,
        name:     f.name,
        fieldKey: f.fieldKey || f.key || null,
        model:    f.model || null,
      })),
    };
  }

  return res.status(200).json(filtered);
}
