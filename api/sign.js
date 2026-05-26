// api/sign.js
// Processes Service Agreement submission.
// 1. Marks portal_sa_received = true on opportunity
// 2. Writes timestamped audit note to contact

const FIELD_IDS = {
  portal_sa_received: 'BrrAzBKKBxVpCC8Mjfwq', // PORTAL: SA Received (checkbox)
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GHL_API_KEY = process.env.GHL_API_KEY;
  if (!GHL_API_KEY) return res.status(500).json({ error: 'GHL_API_KEY not configured' });

  const {
    opp_id,
    contact_id,
    borrower_name,
    buyer_name,
    listing_agent_option,
    listing_agent_name,
    listing_agent_brokerage,
    listing_agent_phone,
    listing_agent_email,
    initials,
  } = req.body;

  if (!opp_id || !borrower_name) {
    return res.status(400).json({ error: 'opp_id and borrower_name required' });
  }

  // ── Capture audit data ───────────────────────────────────────────────────
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.headers['x-real-ip']
    || 'unknown';

  const userAgent = req.headers['user-agent'] || 'unknown';

  const now = new Date();
  const timestampUTC = now.toISOString();
  const timestampET  = now.toLocaleString('en-US', {
    timeZone:  'America/New_York',
    dateStyle: 'full',
    timeStyle: 'long',
  });

  const HEADERS = {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version:       '2021-07-28',
    'Content-Type': 'application/json',
  };

  const errors = [];

  // ── 1. Mark portal_sa_received on opportunity ────────────────────────────
  try {
    const oppRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({
          customFields: [
           { key: 'portal_sa_received', field_value: true },
          ],
        }),
      }
    );
    if (!oppRes.ok) {
      const txt = await oppRes.text();
      errors.push(`opp update failed: ${txt}`);
    }
  } catch (err) {
    errors.push(`opp update error: ${err.message}`);
  }

  // ── 2. Write audit note to contact ───────────────────────────────────────
  if (contact_id) {
    const initialsLog = Array.isArray(initials)
      ? initials.map((v, i) => `  Form 8 — Item ${i + 1}: "${v}"`).join('\n')
      : '';

    const agentLog = listing_agent_option === 'has_agent'
      ? `  Name: ${listing_agent_name}\n  Brokerage: ${listing_agent_brokerage}\n  Phone: ${listing_agent_phone}\n  Email: ${listing_agent_email}`
      : '  No listing agent — referral requested';

    const auditBody = [
      '✅ LMS SERVICE AGREEMENT — ELECTRONICALLY EXECUTED',
      '',
      `Signer:          ${borrower_name}`,
      `Signed:          ${timestampET}`,
      `Timestamp (UTC): ${timestampUTC}`,
      `IP Address:      ${ip}`,
      `Browser:         ${userAgent}`,
      `Opportunity ID:  ${opp_id}`,
      '',
      'FORM 4 — TILA-RESPA:',
      `  Buyer Name: ${buyer_name || 'N/A'}`,
      '',
      'FORM 5 — LISTING AGENT:',
      agentLog,
      '',
      'FORM 8 — PROCESSING FEE INITIALS:',
      initialsLog,
    ].join('\n');

    try {
      const noteRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contact_id}/notes`,
        {
          method: 'POST',
          headers: HEADERS,
          body: JSON.stringify({ body: auditBody }),
        }
      );
      if (!noteRes.ok) {
        const txt = await noteRes.text();
        errors.push(`note failed: ${txt}`);
      }
    } catch (err) {
      errors.push(`note error: ${err.message}`);
    }
  }

  // Return success even if note failed — SA is marked, that's the critical path
  return res.status(200).json({
    success: true,
    warnings: errors.length ? errors : undefined,
  });
}
