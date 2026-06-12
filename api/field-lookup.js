
const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';
const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';

export default async function handler(req, res) {
  try {
    const defRes = await fetch(
      `${GHL_API_BASE}/locations/${GHL_LOCATION_ID}/customFields?model=opportunity`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Version': GHL_API_VERSION,
          'Content-Type': 'application/json'
        }
      }
    );

    const defData = await defRes.json();
    const defs = defData.customFields || [];

    return res.status(200).json({
      success: true,
      total: defs.length,
      fields: defs.map(f => ({ id: f.id, key: f.fieldKey, name: f.name, folder: f.folderName }))
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
