// api/file-start-submit.js
// Receives File Start Form submission, creates GHL contact + fires FSF workflow tag

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const d = req.body;

  if (!d.fs_seller_email || !d.fs_seller_full_name) {
    return res.status(400).json({ error: 'Seller name and email are required' });
  }

  try {
    // Parse seller name
    const nameParts = (d.fs_seller_full_name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build GHL contact payload (primary = Seller #1)
    const contactPayload = {
      locationId: GHL_LOCATION_ID,
      firstName,
      lastName,
      email: d.fs_seller_email || '',
      phone: d.fs_seller_phone || '',
      tags: ['fs_form_submitted'],
      customFields: [
        // Listing Agent
        { key: 'fs_submitter_companybrokerage_name', field_value: d.fs_submitter_companybrokerage_name || '' },
        { key: 'fs_submitter_full_name', field_value: d.fs_submitter_full_name || '' },
        { key: 'fs_submitter_phone_number', field_value: d.fs_submitter_phone_number || '' },
        { key: 'fs_submitter_email', field_value: d.fs_submitter_email || '' },
        // Co-Listing Agent
        { key: 'fs_colisting_agent_', field_value: d['fs_colisting_agent_'] || 'No' },
        { key: 'fs_colisting_agent_companybrokerage_name', field_value: d.fs_colisting_agent_companybrokerage_name || '' },
        { key: 'fs_colisting_agent_full_name', field_value: d.fs_colisting_agent_full_name || '' },
        { key: 'fs_colisting_agent_phone', field_value: d.fs_colisting_agent_phone || '' },
        { key: 'colisting_agent_email', field_value: d.colisting_agent_email || '' },
        // TC
        { key: 'fs_is_there_a_transaction_coordinator_tc_for_listing_agent_', field_value: d['fs_is_there_a_transaction_coordinator_tc_for_listing_agent_'] || 'No' },
        { key: 'fs_transaction_coordinator__company_name', field_value: d.fs_transaction_coordinator__company_name || '' },
        { key: 'fs_transaction_coordinator__name', field_value: d.fs_transaction_coordinator__name || '' },
        { key: 'fs_transaction_coordinator__phone', field_value: d.fs_transaction_coordinator__phone || '' },
        { key: 'fs_transaction_coordinator__email', field_value: d.fs_transaction_coordinator__email || '' },
        // Seller
        { key: 'fs_seller_full_name', field_value: d.fs_seller_full_name || '' },
        { key: 'fs_seller_email', field_value: d.fs_seller_email || '' },
        { key: 'fs_seller_phone', field_value: d.fs_seller_phone || '' },
        // Co-Borrower
        { key: 'fs_seller__power_of_attorney', field_value: d.fs_seller__power_of_attorney || 'No' },
        { key: 'fs_seller__poa_full_name', field_value: d.fs_seller__poa_full_name || '' },
        { key: 'fs_coborrower_phone', field_value: d.fs_coborrower_phone || '' },
        { key: 'fs_coborrower_email', field_value: d.fs_coborrower_email || '' },
        // Property
        { key: 'fs_subject_street_address', field_value: d.fs_subject_street_address || '' },
        { key: 'fs_subject_city', field_value: d.fs_subject_city || '' },
        { key: 'fs_subject_state', field_value: d.fs_subject_state || '' },
        { key: 'fs_subject_zip', field_value: d.fs_subject_zip || '' },
        { key: 'fs_subject_county', field_value: d.fs_subject_county || '' },
        { key: 'fs_property_type', field_value: d.fs_property_type || '' },
        { key: 'fs_property_use', field_value: d.fs_property_use || '' },
        { key: 'fs_property_listed_for_sale', field_value: d.fs_property_listed_for_sale || '' },
        { key: 'fs_current_buyer_offer', field_value: d.fs_current_buyer_offer || '' },
        { key: 'fs_pending_foreclosure_sale', field_value: d.fs_pending_foreclosure_sale || '' },
        { key: 'fs_pending_foreclosure_sale_date', field_value: d.fs_pending_foreclosure_sale_date || '' },
        { key: 'fs_solar_lease_or_loan', field_value: d.fs_solar_lease_or_loan || '' },
        { key: 'fs_seller_committed_to_short_sale', field_value: d.fs_seller_committed_to_short_sale || '' },
        { key: 'fs_seller_aware_of_lms', field_value: d.fs_seller_aware_of_lms || '' },
        { key: 'fs_seller_additional_notes', field_value: d.fs_seller_additional_notes || '' },
        { key: 'fs_referred_by', field_value: d.fs_referred_by || '' },
      ].filter(f => f.field_value !== '')
    };

    // Upsert contact in GHL
    const contactRes = await fetch('https://services.leadconnectorhq.com/contacts/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      body: JSON.stringify(contactPayload)
    });

    if (!contactRes.ok) {
      const err = await contactRes.text();
      console.error('GHL contact error:', err);
      return res.status(500).json({ error: 'Failed to create contact in GHL', details: err });
    }

    const contactData = await contactRes.json();
    const contactId = contactData.contact?.id;

    // Add note with submission details
    if (contactId) {
      const noteBody = [
        '📋 FILE START FORM SUBMITTED',
        '',
        `Listing Agent: ${d.fs_submitter_full_name} | ${d.fs_submitter_email} | ${d.fs_submitter_phone_number}`,
        `Brokerage: ${d.fs_submitter_companybrokerage_name}`,
        `Co-LA: ${d['fs_colisting_agent_'] || 'No'}`,
        `TC: ${d['fs_is_there_a_transaction_coordinator_tc_for_listing_agent_'] || 'No'}`,
        '',
        `Seller: ${d.fs_seller_full_name} | ${d.fs_seller_email} | ${d.fs_seller_phone}`,
        `Co-Borrower: ${d.fs_seller__power_of_attorney || 'No'}`,
        '',
        `Property: ${d.fs_subject_street_address}, ${d.fs_subject_city}, ${d.fs_subject_state} ${d.fs_subject_zip}`,
        `County: ${d.fs_subject_county} | Type: ${d.fs_property_type} | Use: ${d.fs_property_use}`,
        `Listed: ${d.fs_property_listed_for_sale} | Buyer Offer: ${d.fs_current_buyer_offer}`,
        `Foreclosure: ${d.fs_pending_foreclosure_sale}${d.fs_pending_foreclosure_sale_date ? ' — ' + d.fs_pending_foreclosure_sale_date : ''}`,
        `Solar: ${d.fs_solar_lease_or_loan} | Committed: ${d.fs_seller_committed_to_short_sale} | Aware of LMS: ${d.fs_seller_aware_of_lms}`,
        d.fs_referred_by ? `Referred by: ${d.fs_referred_by}` : '',
        d.fs_seller_additional_notes ? `Notes: ${d.fs_seller_additional_notes}` : '',
        '',
        `Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EDT`
      ].filter(Boolean).join('\n');

      await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
          'Version': '2021-07-28'
        },
        body: JSON.stringify({ body: noteBody })
      });
    }

    return res.status(200).json({ success: true, contactId });

  } catch (err) {
    console.error('File start submit error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
