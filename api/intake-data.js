
// api/intake-data.js
// Returns pre-fill data for the Seller Intake Form page.
// Pulls from opportunity FS form fields (confirmed IDs from debug-fields, 2026-05-26).

const OPP_FIELD_IDS = {
  seller_name:    'DmA0vggMvgaDQuQtFXwM', // fs_seller_full_name
  seller_phone:   'nCBJtC2i0iK8uwuzUmlZ', // fs_seller_phone
  seller_email:   'GsalqwA6Fer5SetS6SxW', // fs_seller_email
  street:         'bTOQKVASljmlKC3ri7uH', // fs_street_address
  city:           'LQ0MnHCePkhyIXvFqmTF', // fs_city
  state:          'Ocpa5jBIyG52nTViZUxj', // fs_state
  zip:            'Ye3bBHdAY4LOtLLXcwMl', // fs_zip_code
  county:         'pSjlP4aKb4n4AWgjsUSA', // fs_county
  la_name:        'bDmxH95bi0chTpHxA2wr', // fs_your_full_name (submitter = LA)
  la_phone:       'pa5yWsq8BoZ6e43uqXyE', // fs_your_phone_number
  la_email:       'H5uu7kekmBaYxG14v2Dk', // fs_your_email
  la_brokerage:   'QHAaE53pmuq0Gvrhm969', // fs_submitter_companybrokerage_name
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
    // Fetch opportunity for FS form pre-fill data
    const oppRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      { headers: HEADERS }
    );
    if (!oppRes.ok) throw new Error('Opportunity fetch failed');
    const oppData = await oppRes.json();
    const opp = oppData.opportunity || oppData;

    // Build field value lookup
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
      // Pre-fill seller info
      seller_name:      get(OPP_FIELD_IDS.seller_name),
      seller_phone:     get(OPP_FIELD_IDS.seller_phone),
      seller_email:     get(OPP_FIELD_IDS.seller_email),
      // Pre-fill property address
      street:           get(OPP_FIELD_IDS.street),
      city:             get(OPP_FIELD_IDS.city),
      state:            get(OPP_FIELD_IDS.state),
      zip:              get(OPP_FIELD_IDS.zip),
      county:           get(OPP_FIELD_IDS.county),
      // Pre-fill listing agent
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
