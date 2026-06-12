
const GHL_API_KEY = 'pit-ef3edd31-9163-4c64-9e18-62633fb931fe';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_VERSION = '2021-07-28';

function getField(fields, key) {
  const short = key.replace('opportunity.', '');
  const f = fields.find(f =>
    f.key === short ||
    f.key === key ||
    f.fieldKey === key ||
    f.fieldKey === `opportunity.${short}`
  );
  if (!f) return null;
  const val = f.value ?? f.fieldValue ?? f.fieldValueArray?.[0] ?? null;
  return val || null;
}

function isChecked(fields, key) {
  const short = key.replace('opportunity.', '');
  const f = fields.find(f =>
    f.key === short ||
    f.key === key ||
    f.fieldKey === key ||
    f.fieldKey === `opportunity.${short}`
  );
  if (!f) return false;
  const val = f.value ?? f.fieldValue ?? f.fieldValueArray ?? null;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'string') return val === 'true' || val === '1' || val.toLowerCase() === 'yes';
  return false;
}

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

    const createdAt = opp.createdAt ? new Date(opp.createdAt) : null;
    const fileStartDate = createdAt
      ? createdAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null;
    const daysActive = createdAt
      ? Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const data = {
      fileStartDate,
      daysActive,
      stageName: opp.pipelineStageId || null,
      oppName: opp.name || '',

      // Header
      propertyAddress: getField(fields, 'opportunity.fd_subject_property_address'),
      county: getField(fields, 'opportunity.fd_subject_property_county'),
      sellerName: getField(fields, 'opportunity.fd_sellerprimary_borrower_name'),

      // Section 1 — Seller Intake
      saSignedField: isChecked(fields, 'opportunity.fd_service_agreement_signed'),
      sifSubmitted: isChecked(fields, 'opportunity.fd_seller_intake_form_submitted'),
      thirdPartyReceived: isChecked(fields, 'opportunity.fd_thirdparty_authorization_received'),
      mortgageReceived: isChecked(fields, 'opportunity.fd_mortgage_statement_received'),

      // Section 2 — Seller Info
      sellerPhone: getField(fields, 'opportunity.fd_sellerprimary_borrower_phone'),
      sellerEmail: getField(fields, 'opportunity.fd_sellerprimary_borrower_email'),
      sellerMailingAddress: getField(fields, 'opportunity.fd_sellerprimary_borrower_mailing_address'),
      coBorrowerName: getField(fields, 'opportunity.fd_sellercoborrower_name'),
      coBorrowerPhone: getField(fields, 'opportunity.fd_sellercoborrower_phone'),
      coBorrowerEmail: getField(fields, 'opportunity.fd_sellercoborrower_email'),

      // Section 3 — Creditors
      lender1Name: getField(fields, 'opportunity.fd_lender_1_name'),
      lender1Balance: getField(fields, 'opportunity.fd_lender_1_estimated_balance'),
      lender2Name: getField(fields, 'opportunity.fd_lenderservicer_2_name'),
      lender2Balance: getField(fields, 'opportunity.fd_lenderservicer_2_estimated_balance'),
      hoaYesNo: getField(fields, 'opportunity.fd_home_owners_association'),
      hoa1Name: getField(fields, 'opportunity.fd_hoa_1_name'),
      hoa1Balance: getField(fields, 'opportunity.fd_hoa_1_estimated_balance'),
      hoa2Name: getField(fields, 'opportunity.fd_hoa_2_name'),
      hoa2Balance: getField(fields, 'opportunity.fd_hoa_2_estimated_balance'),
      hoa3Name: getField(fields, 'opportunity.fd_hoa_3_name'),
      hoa3Balance: getField(fields, 'opportunity.fd_hoa_3_estimated_balance'),

      // Section 4 — Listing Agent
      laName: getField(fields, 'opportunity.fd_listing_agent_name'),
      laBrokerage: getField(fields, 'opportunity.fd_listing_agent_brokeragecompany_name'),
      laPhone: getField(fields, 'opportunity.fd_listing_agent_phone'),
      laEmail: getField(fields, 'opportunity.fd_listing_agent_email'),

      // Section 5 — Buyer 1 / Buyer Agent 1
      ba1Name: getField(fields, 'opportunity.fd_buyer_agent_1_name'),
      ba1Brokerage: getField(fields, 'opportunity.fd_buyer_agent_1_brokeragecompany_name'),
      ba1Phone: getField(fields, 'opportunity.fd_buyer_agent_1_phone'),
      ba1Email: getField(fields, 'opportunity.fd_buyer_agent_1_email'),
      buyer1Name: getField(fields, 'opportunity.fd_buyer_1_name'),
      buyer1Contact: getField(fields, 'opportunity.fd_buyer_1_contact_name'),
      buyer1Phone: getField(fields, 'opportunity.fd_buyer_1_phone'),
      buyer1Email: getField(fields, 'opportunity.fd_buyer_1_email'),
      buyer1Financing: getField(fields, 'opportunity.fd_buyer_1_financing_type'),

      // Section 5 — Buyer 2 / Buyer Agent 2
      ba2Name: getField(fields, 'opportunity.fd_buyer_agent_2_name'),
      ba2Brokerage: getField(fields, 'opportunity.fd_buyer_agent_2_brokeragecompany_name'),
      ba2Phone: getField(fields, 'opportunity.fd_buyer_agent_2_phone'),
      ba2Email: getField(fields, 'opportunity.fd_buyer_agent_2_email'),
      buyer2Name: getField(fields, 'opportunity.fd_buyer_2_name'),
      buyer2Contact: getField(fields, 'opportunity.fd_buyer_2_contact_name'),
      buyer2Phone: getField(fields, 'opportunity.fd_buyer_2_phone'),
      buyer2Email: getField(fields, 'opportunity.fd_buyer_2_email'),

      // Section 6 — BPO
      bpo1Date: getField(fields, 'opportunity.fd_bpo_1_date_monthyear'),
      bpo1Amount: getField(fields, 'opportunity.fd_bpo_1_amount'),
      bpo2Date: getField(fields, 'opportunity.fd_bpo_2_date_monthyear'),
      bpo2Amount: getField(fields, 'opportunity.fd_bpo_2_amount'),

      // Section 7 — Closing Info
      titleCompany: getField(fields, 'opportunity.fd_title_company_name'),
      titleAgent: getField(fields, 'opportunity.fd_title_company_agent'),
      titlePhone: getField(fields, 'opportunity.fd_title_company_phone'),
      titleEmail: getField(fields, 'opportunity.fd_title_company_agent_email'),
      closeDate: getField(fields, 'opportunity.fd_close_date'),
      deficiencyWaived: getField(fields, 'opportunity.fd_deficiency_waived'),
      relocationAwarded: getField(fields, 'opportunity.fd_relocation_assistance_awarded'),
      relocationAmount: getField(fields, 'opportunity.fd_relocation_assistance_amount'),
    };

    return res.status(200).json({ success: true, data });

  } catch (err) {
    console.error('File detail error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  }
}
