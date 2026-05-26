// api/intake-data.js
// Returns pre-fill data for the Seller Intake Form page.
// Pulls from opportunity FS form fields (confirmed IDs from debug-fields, 2026-05-26).

const OPP_FIELD_IDS = {
  seller_name:    'DmA0vggMvgaDQuQtFXwM',
  seller_phone:   'nCBJtC2i0iK8uwuzUmlZ',
  seller_email:   'GsalqwA6Fer5SetS6SxW',
  street:         'bTOQKVASljmlKC3ri7uH',
  city:           'LQ0MnHCePkhyIXvFqmTF',
  state:          'Ocpa5jBIyG52nTViZUxj',
  zip:            'Ye3bBHdAY4LOtLLXcwMl',
  county:         'pSjlP4aKb4n4AWgjsUSA',
  la_name:        'bDmxH95bi0chTpHxA2wr',
  la_phone:       'pa5yWsq8BoZ6e43uqXyE',
  la_email:       'H5uu7kekmBaYxG14v2Dk',
  la_brokerage:   'QHAaE53pmuq0Gvrhm969',
};

export default async function handler(req, res) {
  const { opp_id } = req.query;
  if (!opp_id) return res.status(400).json({ error: 'opp_id required' });

  const GHL_API_KEY = process.env.GHL_API_KEY;
  if (!GHL_API_KEY) return res.status(500).json({ error: 'GHL_API_KEY not configured' });

  const HEADERS = {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: '2021-07-28',
  };

  try {
    const oppRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      { headers: HEADERS }
    );
    if (!oppRes.ok) throw new Error('Opportunity fetch failed');
    const oppData = await oppRes.json();
    const opp = oppData.opportunity || oppData;

    const fieldMap = {};
    for (const f of (opp.customFields || [])) {
      const val = f.fieldValue ?? f.field_value ?? f.value ?? null;
      fieldMap[f.id] = Array.isArray(val) ? val[0] : val;
    }

    const get = (id) => fieldMap[id] || '';
    const contact = opp.contact || {};

    return res.status(200).json({
      opp_id,
      contact_id:       contact.id || '',
      file_reference:   opp.name || '',
      seller_name:      get(OPP_FIELD_IDS.seller_name),
      seller_phone:     get(OPP_FIELD_IDS.seller_phone),
      seller_email:     get(OPP_FIELD_IDS.seller_email),
      street:           get(OPP_FIELD_IDS.street),
      city:             get(OPP_FIELD_IDS.city),
      state:            get(OPP_FIELD_IDS.state),
      zip:              get(OPP_FIELD_IDS.zip),
      county:           get(OPP_FIELD_IDS.county),
      la_name:          get(OPP_FIELD_IDS.la_name),
      la_phone:         get(OPP_FIELD_IDS.la_phone),
      la_email:         get(OPP_FIELD_IDS.la_email),
      la_brokerage:     get(OPP_FIELD_IDS.la_brokerage),
    });

  } catch (err) {
    console.error('[intake-data]', err);
    return res.status(500).json({ error: err.message });
  }
}
