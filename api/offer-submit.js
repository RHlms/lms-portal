// api/offer-submit.js
// Writes OIF fields to GHL contact + opportunity fields
// Auto-checks offer_intake_form checkbox on opportunity

const GHL_API_KEY = process.env.GHL_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body;
  const { opp_id } = body;
  if (!opp_id) return res.status(400).json({ error: 'Missing opp_id' });

  try {
    // 1. Fetch opportunity to get contact ID
    const oppRes = await fetch(`https://services.leadconnectorhq.com/opportunities/${opp_id}`, {
      headers: { 'Authorization': `Bearer ${GHL_API_KEY}`, 'Version': '2021-07-28' }
    });
    if (!oppRes.ok) throw new Error(`Failed to fetch opportunity: ${oppRes.status}`);
    const oppData = await oppRes.json();
    const opp = oppData.opportunity || oppData;
    const contactId = opp.contact?.id || opp.contactId;
    if (!contactId) throw new Error('No contact ID found');

    // 2. Build contact custom fields payload
    const contactFields = [
      { key: 'oif_seller_name_as_deeded',                         value: body.oif_seller_name_as_deeded },
      { key: 'oif_subject_property_address__full_',               value: body.oif_subject_property_address__full_ },
      { key: 'oif_purchase_price',                                 value: body.oif_purchase_price },
      { key: 'oif_escrowdeposit_amount',                           value: body.oif_escrowdeposit_amount },
      { key: 'oif_inspection__due_diligence_days',                 value: body.oif_inspection__due_diligence_days },
      { key: 'oif_close_date',                                     value: body.oif_close_date },
      { key: 'oif_additional_terms',                               value: body.oif_additional_terms },
      { key: 'oif_title_company_name',                             value: body.oif_title_company_name },
      { key: 'oif_title_agent_name',                               value: body.oif_title_agent_name },
      { key: 'oif_title_agent_phone',                              value: body.oif_title_agent_phone },
      { key: 'oif_title_agent_email',                              value: body.oif_title_agent_email },
      { key: 'oif_listing_agent_company__brokerage',               value: body.oif_listing_agent_company__brokerage },
      { key: 'oif_listing_agent_name',                             value: body.oif_listing_agent_name },
      { key: 'oif_listing_agent_phone',                            value: body.oif_listing_agent_phone },
      { key: 'oif_listing_agent_email',                            value: body.oif_listing_agent_email },
      { key: 'oif_listing_agent_commission_',                      value: body.oif_listing_agent_commission_ },
      { key: 'oif_listing_agent__transaction__admin_fee',          value: body.oif_listing_agent__transaction__admin_fee },
      { key: 'oif_listing_agent_transaction__admin_fee_amount',    value: body.oif_listing_agent_transaction__admin_fee_amount },
      { key: 'oif_listing_agent_transaction__admin_fee_paid_by',   value: body.oif_listing_agent_transaction__admin_fee_paid_by },
      { key: 'oif_listing_agent__transaction_coordinator',         value: body.oif_listing_agent__transaction_coordinator },
      { key: 'oif_listing_agent__tc_company__brokerage_name',      value: body.oif_listing_agent__tc_company__brokerage_name },
      { key: 'oif_listing_agent__transaction_coordinator___tc__name', value: body.oif_listing_agent__transaction_coordinator___tc__name },
      { key: 'oif_listing_agent__tc_phone',                        value: body.oif_listing_agent__tc_phone },
      { key: 'oif_listing_agent__tc_email',                        value: body.oif_listing_agent__tc_email },
      { key: 'oif_co_listing_agent',                               value: body.oif_co_listing_agent },
      { key: 'oif_co_listing_agent_brokerage___company_name',      value: body.oif_co_listing_agent_brokerage___company_name },
      { key: 'oif_co_listing_agent_name',                          value: body.oif_co_listing_agent_name },
      { key: 'oif_co_listing_agent_phone',                         value: body.oif_co_listing_agent_phone },
      { key: 'oif_co_listing_agent_email',                         value: body.oif_co_listing_agent_email },
      { key: 'oif_buyer_agent___brokerage_company_name',           value: body.oif_buyer_agent___brokerage_company_name },
      { key: 'oif_buyer_agent_name',                               value: body.oif_buyer_agent_name },
      { key: 'oif_buyer_agent_phone',                              value: body.oif_buyer_agent_phone },
      { key: 'oif_buyer_agent_email',                              value: body.oif_buyer_agent_email },
      { key: 'oif_buyeragent_commission_',                         value: body.oif_buyeragent_commission_ },
      { key: 'oif_buyer_agent__transaction___admin_fee',           value: body.oif_buyer_agent__transaction___admin_fee },
      { key: 'oif_buyer_agent__transaction___admin_fee_amount',    value: body.oif_buyer_agent__transaction___admin_fee_amount },
      { key: 'oif_buyer_agent__transaction___admin_fee_paid_by',   value: body.oif_buyer_agent__transaction___admin_fee_paid_by },
      { key: 'oif_buyer_agent__transaction_coordinator',           value: body.oif_buyer_agent__transaction_coordinator },
      { key: 'oif_buyer_agent___tc_company_name',                  value: body.oif_buyer_agent___tc_company_name },
      { key: 'oif_buyer_agent___tc_name',                          value: body.oif_buyer_agent___tc_name },
      { key: 'oif_buyer_agent___tc_phone',                         value: body.oif_buyer_agent___tc_phone },
      { key: 'oif_buyer_agent___tc_email',                         value: body.oif_buyer_agent___tc_email },
      { key: 'oif_buyer___corporate_entity',                       value: body.oif_buyer___corporate_entity },
      { key: 'oif_buyer___financing_type',                         value: body.oif_buyer___financing_type },
      { key: 'oif_buyer__property_use',                            value: body.oif_buyer__property_use },
      { key: 'oif_buyer_name_as_deeded',                           value: body.oif_buyer_name_as_deeded },
      { key: 'buyer_name_contact',                                 value: body.buyer_name_contact },
      { key: 'oif_buyer_phone',                                    value: body.oif_buyer_phone },
      { key: 'oif_buyer_email',                                    value: body.oif_buyer_email },
      { key: 'oif_buyer_mailing_address',                          value: body.oif_buyer_mailing_address },
    ].filter(f => f.value !== undefined && f.value !== '');

    // 3. Update contact
    const contactUpdate = await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ customFields: contactFields })
    });
    if (!contactUpdate.ok) {
      const errText = await contactUpdate.text();
      throw new Error(`Contact update failed: ${contactUpdate.status} — ${errText}`);
    }

    // 4. Update opportunity fields + auto-check offer_intake_form
    const oppFields = [
      { key: 'oif_seller_name',                       value: body.oif_seller_name_as_deeded },
      { key: 'oif_subject_property_address',           value: body.oif_subject_property_address__full_ },
      { key: 'oif_buyer_name',                         value: body.oif_buyer_name_as_deeded },
      { key: 'oif_buyer_financing_type',               value: body.oif_buyer___financing_type },
      { key: 'oif_purchase_price',                     value: body.oif_purchase_price },
      { key: 'oif_depositescrow_amount',               value: body.oif_escrowdeposit_amount },
      { key: 'oif_inspection__due_diligence_days',     value: body.oif_inspection__due_diligence_days },
      { key: 'oif_close_date',                         value: body.oif_close_date },
      { key: 'oif_title_company_name',                 value: body.oif_title_company_name },
      { key: 'oif_title_contact_name',                 value: body.oif_title_agent_name },
      { key: 'oif_title_contact_phone',                value: body.oif_title_agent_phone },
      { key: 'oif_title_contact_email',                value: body.oif_title_agent_email },
      { key: 'listing_agent_name',                     value: body.oif_listing_agent_name },
      { key: 'listing_agent_companybrokerage',         value: body.oif_listing_agent_company__brokerage },
      { key: 'listing_agent_phone',                    value: body.oif_listing_agent_phone },
      { key: 'listing_agent_email',                    value: body.oif_listing_agent_email },
      { key: 'oif_listing_agent_commission_',          value: body.oif_listing_agent_commission_ },
      { key: 'oif_transaction__admin_fee',             value: body.oif_listing_agent__transaction__admin_fee },
      { key: 'oif_transaction__admin_fee_amount',      value: body.oif_listing_agent_transaction__admin_fee_amount },
      { key: 'oif_listing_agent_transactionadmin_fee_paid_by', value: body.oif_listing_agent_transaction__admin_fee_paid_by },
      { key: 'oif_listing_agent__transaction_coordinator', value: body.oif_listing_agent__transaction_coordinator },
      { key: 'oif_listing_agent__tc_name',             value: body.oif_listing_agent__transaction_coordinator___tc__name },
      { key: 'oif_listing_agent__tc_phone',            value: body.oif_listing_agent__tc_phone },
      { key: 'oif_listing_agent__tc_email',            value: body.oif_listing_agent__tc_email },
      { key: 'oif_buyer_agent_name_full',              value: body.oif_buyer_agent_name },
      { key: 'oif_buyer_agent_company__brokerage',     value: body.oif_buyer_agent___brokerage_company_name },
      { key: 'oif_buyeragent_email',                   value: body.oif_buyer_agent_email },
      { key: 'oif_buyeragent_commission_',             value: body.oif_buyeragent_commission_ },
      { key: 'oif_buyeragent_transaction__admin_fee',  value: body.oif_buyer_agent__transaction___admin_fee },
      { key: 'oif_buyeragent_transactionadmin_fee_amount', value: body.oif_buyer_agent__transaction___admin_fee_amount },
      { key: 'oif_buyeragent_transactionadmin_fee_paid_by', value: body.oif_buyer_agent__transaction___admin_fee_paid_by },
      { key: 'buyeragent__transaction_coordinator',    value: body.oif_buyer_agent__transaction_coordinator },
      { key: 'buyeragent__tc_name',                    value: body.oif_buyer_agent___tc_name },
      { key: 'buyeragent__tc_phone',                   value: body.oif_buyer_agent___tc_phone },
      { key: 'buyeragent__tc_email',                   value: body.oif_buyer_agent___tc_email },
      // Auto-check OIF received
      { key: 'offer_intake_form',                      value: ['Offer Intake Form'] },
    ].filter(f => f.value !== undefined && f.value !== '');

    const oppUpdate = await fetch(`https://services.leadconnectorhq.com/opportunities/${opp_id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ customFields: oppFields })
    });
    if (!oppUpdate.ok) {
      const errText = await oppUpdate.text();
      throw new Error(`Opportunity update failed: ${oppUpdate.status} — ${errText}`);
    }

    // 5. Add GHL note for audit trail
    await fetch(`https://services.leadconnectorhq.com/contacts/${contactId}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: `✅ OFFER INTAKE FORM submitted via LMS Portal\nSubmitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\nBuyer: ${body.oif_buyer_name_as_deeded || 'N/A'}\nPurchase Price: ${body.oif_purchase_price || 'N/A'}\nClose Date: ${body.oif_close_date || 'N/A'}\nBuyer Agent: ${body.oif_buyer_agent_name || 'N/A'}`,
        userId: null
      })
    });

    return res.status(200).json({ success: true, message: 'OIF submitted successfully' });

  } catch (err) {
    console.error('offer-submit error:', err);
    return res.status(500).json({ error: err.message });
  }
}
