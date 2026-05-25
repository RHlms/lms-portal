export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { opp_id } = req.query;
  if (!opp_id) return res.status(400).json({ error: 'Missing opp_id' });

  try {
    const ghlRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Version': '2021-07-28'
        }
      }
    );

    if (!ghlRes.ok) {
      const text = await ghlRes.text();
      console.error('GHL error:', ghlRes.status, text);
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    const data = await ghlRes.json();
    console.log('GHL response sample:', JSON.stringify(data).slice(0, 500));

    const opp = data.opportunity || data;
    const customFields = opp.customFields || [];

    const getField = (key) => {
      const f = customFields.find(f => f.key === key || f.fieldKey === key);
      if (!f) return false;
      return f.value === true || f.value === 'true' || f.value === '1' || f.value === 1;
    };

    return res.status(200).json({
      address: opp.name || 'File ' + opp_id,
      items: {
        sa:       getField('portal_sa_received'),
        sif:      getField('portal_sif_received'),
        threepa:  getField('portal_3pa_received'),
        mortgage: getField('portal_mortgage_statement_received')
      }
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
