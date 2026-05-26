// api/sign-data.js
// Returns pre-fill data for the SA signing page.
// Field IDs confirmed from debug-fields endpoint (2026-05-26).

const FIELD_IDS = {
  seller_name:    'DmA0vggMvgaDQuQtFXwM', // fs_seller_full_name
  street_address: 'bTOQKVASljmlKC3ri7uH', // fs_street_address
  city:           'LQ0MnHCePkhyIXvFqmTF', // fs_city
  state:          'Ocpa5jBIyG52nTViZUxj', // fs_state
  zip:            'Ye3bBHdAY4LOtLLXcwMl', // fs_zip_code
  la_name:        'bDmxH95bi0chTpHxA2wr', // fs_your_full_name (submitter = listing agent)
  la_email:       'H5uu7kekmBaYxG14v2Dk', // fs_your_email
  la_phone:       'pa5yWsq8BoZ6e43uqXyE', // fs_your_phone_number
  la_brokerage:   'QHAaE53pmuq0Gvrhm969', // fs_submitter_companybrokerage_name
};

export default async function handler(req, res) {
  const { opp_id } = req.query;
  if (!opp_id) return res.status(400).json({ error: 'opp_id required' });

  const GHL_API_KEY = process.env.GHL_API_KEY;
  if (!GHL_API_KEY) return res.status(500).json({ error: 'GHL_API_KEY not configured' });

  try {
    const oppRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28',
        },
      }
    );

    if (!oppRes.ok) return res.status(502).json({ error: 'GHL fetch failed' });

    const oppData = await oppRes.json();
    const opp     = oppData.opportunity || oppData;

    // Build field lookup map
    const fieldMap = {};
    for (const f of (opp.customFields || [])) {
      fieldMap[f.id] = f.fieldValue ?? f.field_value ?? f.value ?? '';
    }

    const get = (id) => {
      const v = fieldMap[id];
      return Array.isArray(v) ? v[0] : (v || '');
    };

    const street = get(FIELD_IDS.street_address);
    const city   = get(FIELD_IDS.city);
    const state  = get(FIELD_IDS.state);
    const zip    = get(FIELD_IDS.zip);
    const fullAddress = [street, city, state, zip].filter(Boolean).join(', ');

    const contact = opp.contact || {};

    return res.status(200).json({
      opp_id,
      contact_id:     contact.id || '',
      seller_name:    get(FIELD_IDS.seller_name) || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      property_address: fullAddress,
      la_name:        get(FIELD_IDS.la_name),
      la_email:       get(FIELD_IDS.la_email),
      la_phone:       get(FIELD_IDS.la_phone),
      la_brokerage:   get(FIELD_IDS.la_brokerage),
    });

  } catch (err) {
    console.error('[sign-data] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
