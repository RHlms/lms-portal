// api/offer-data.js
// Pre-fills OIF from GHL opportunity + contact fields

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { opp_id } = req.query;
  if (!opp_id) return res.status(400).json({ error: 'Missing opp_id' });

  try {
    // Fetch opportunity
    const oppRes = await fetch(`https://services.leadconnectorhq.com/opportunities/${opp_id}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28'
      }
    });

    if (!oppRes.ok) throw new Error(`GHL opportunity fetch failed: ${oppRes.status}`);
    const oppData = await oppRes.json();
    const opp = oppData.opportunity || oppData;

    const contactId = opp.contact?.id || opp.contactId;
    if (!contactId) throw new Error('No contact ID on opportunity');

    // Fetch contact
    const contactRes = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28'
      }
    });

    if (!contactRes.ok) throw new Error(`GHL contact fetch failed: ${contactRes.status}`);
    const contactData = await contactRes.json();
    const contact = contactData.contact || contactData;

    // Helper to get custom field value
    const getField = (fields, key) => {
      if (!fields) return '';
      const f = fields.find(f => f.key === key || f.id === key);
      return f ? (f.value || '') : '';
    };

    const cf = contact.customFields || [];
    const of = opp.customFields || [];

    // Build response — check opp fields first, fall back to contact fields
    const data = {
      // Pre-fill fields
      oif_seller_name_as_deeded: getField(cf, 'oif_seller_name_as_deeded') || `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      oif_subject_property_address: getField(cf, 'oif_subject_property_address__full_') || getField(cf, 'fs_subject_street_address') || contact.address1 || '',
      oif_listing_agent_company__brokerage: getField(cf, 'oif_listing_agent_company__brokerage') || getField(cf, 'fs_submitter_company_brokerage_name') || '',
      oif_listing_agent_name: getField(cf, 'oif_listing_agent_name') || getField(cf, 'fs_submitter_full_name') || '',
      oif_listing_agent_phone: getField(cf, 'oif_listing_agent_phone') || getField(cf, 'fs_submitter_phone_number') || '',
      oif_listing_agent_email: getField(cf, 'oif_listing_agent_email') || getField(cf, 'fs_submitter_email') || '',

      // Pass through for fallback
      first_name: contact.firstName || '',
      last_name: contact.lastName || '',
      fs_subject_street_address: getField(cf, 'fs_subject_street_address') || contact.address1 || '',
      fs_submitter_full_name: getField(cf, 'fs_submitter_full_name') || '',
      fs_submitter_phone_number: getField(cf, 'fs_submitter_phone_number') || '',
      fs_submitter_email: getField(cf, 'fs_submitter_email') || '',
      fs_submitter_company_brokerage_name: getField(cf, 'fs_submitter_company_brokerage_name') || '',
    };

    return res.status(200).json(data);

  } catch (err) {
    console.error('offer-data error:', err);
    return res.status(500).json({ error: err.message });
  }
}
