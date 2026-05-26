
// api/intake-submit.js
// Processes Seller Intake Form submission.
// 1. Writes all SIF fields to the contact record
// 2. Sets portal_sif_received = true on the opportunity

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GHL_API_KEY = process.env.GHL_API_KEY;
  if (!GHL_API_KEY) return res.status(500).json({ error: 'GHL_API_KEY not configured' });

  const { opp_id, contact_id, fields } = req.body;
  if (!opp_id || !contact_id || !fields) {
    return res.status(400).json({ error: 'opp_id, contact_id, and fields required' });
  }

  const HEADERS = {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };

  const errors = [];

  // ── 1. Write all SIF fields to contact ────────────────────────────────
  // Build customFields array from submitted form data.
  // field keys match GHL contact field keys exactly (without "contact." prefix).
  const customFields = Object.entries(fields)
    .filter(([, val]) => val !== '' && val !== null && val !== undefined)
    .map(([key, val]) => ({ key, field_value: val }));

  if (customFields.length > 0) {
    try {
      const contactRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contact_id}`,
        {
          method: 'PUT',
          headers: HEADERS,
          body: JSON.stringify({ customFields }),
        }
      );
      if (!contactRes.ok) {
        const txt = await contactRes.text();
        errors.push(`contact update failed: ${txt}`);
        console.error('[intake-submit] contact update failed:', txt);
      }
    } catch (err) {
      errors.push(`contact update error: ${err.message}`);
      console.error('[intake-submit] contact error:', err);
    }
  }

  // ── 2. Set portal_sif_received on opportunity ──────────────────────────
  try {
    const oppRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({
          customFields: [{ key: 'portal_sif_received', field_value: true }],
        }),
      }
    );
    if (!oppRes.ok) {
      const txt = await oppRes.text();
      errors.push(`opp update failed: ${txt}`);
      console.error('[intake-submit] opp update failed:', txt);
    }
  } catch (err) {
    errors.push(`opp update error: ${err.message}`);
    console.error('[intake-submit] opp error:', err);
  }

  return res.status(200).json({
    success: errors.length === 0,
    warnings: errors.length ? errors : undefined,
  });
}
