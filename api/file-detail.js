const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { id: oppId } = req.query;
  if (!oppId) return res.status(400).json({ error: 'Opportunity ID required' });
  try {
    const oppRes = await fetch(`${GHL_API_BASE}/opportunities/${oppId}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': GHL_API_VERSION,
        'Content-Type': 'application/json'
      }
    });
    if (!oppRes.ok) return res.status(404).json({ error: 'File not found' });
    const oppData = await oppRes.json();
    const opp = oppData.opportunity || oppData;
    const fields = opp.customFields || [];
    return res.status(200).json({
      success: true,
      debug: fields.map(f => ({
        id: f.id,
        value: f.value ?? f.fieldValue ?? f.fieldValueArray ?? null
      })).filter(f => f.value !== null && f.value !== '' && f.value !== 'n/a')
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
