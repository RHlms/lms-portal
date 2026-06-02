// api/offer-data.js — DEBUG VERSION
const GHL_API_KEY = process.env.GHL_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { opp_id } = req.query;
  if (!opp_id) return res.status(400).json({ error: 'Missing opp_id' });
  try {
    const oppRes = await fetch(`https://services.leadconnectorhq.com/opportunities/${opp_id}`, {
      headers: { 'Authorization': `Bearer ${GHL_API_KEY}`, 'Version': '2021-07-28' }
    });
    if (!oppRes.ok) throw new Error(`GHL opportunity fetch failed: ${oppRes.status}`);
    const oppData = await oppRes.json();
    const opp = oppData.opportunity || oppData;
    const of = opp.customFields || [];
    return res.status(200).json({ debug_fields: of });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
