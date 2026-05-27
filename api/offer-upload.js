import formidable from 'formidable';

export const config = { api: { bodyParser: false } };

const DOC_TYPES = {
  listing_agreement:  { label: 'Listing Agreement',                    field: 'offer_docs_listing_agreement' },
  ss_addendum_asis:   { label: 'SS Addendum to As-Is Contract',        field: 'offer_docs_ss_addendum' },
  mls_sheet:          { label: 'MLS Sheet',                            field: 'offer_docs_mls_sheet' },
  asis_contract:      { label: 'As-Is Contract',                       field: 'offer_docs_asis_contract' },
  buyer_disclosure:   { label: 'LMS Buyer Disclosure',                 field: 'offer_docs_lms_buyer_disclosure' },
  ss_addendum_la:     { label: 'SS Addendum to Listing Agreement',     field: 'offer_docs_ss_addendum_to_listing_agreement' },
  proof_of_funds:     { label: 'Buyer Proof of Funds / Approval Letter', field: 'offer_docs_buyer_proof_of_fundsapproval_letter' },
};

async function updateGHLField(oppId, fieldKey) {
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${oppId}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${process.env.GHL_API_KEY}`,
          'Content-Type':  'application/json',
          'Version':       '2021-07-28',
        },
        body: JSON.stringify({
          customFields: [{ key: fieldKey, field_value: ['Received'] }],
        }),
      }
    );
    const data = await res.json();
    console.log('GHL update response:', JSON.stringify(data).slice(0, 300));
    return res.ok;
  } catch (err) {
    console.error('GHL update error:', err);
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const form = formidable({ maxFileSize: 20 * 1024 * 1024 });
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const oppId  = Array.isArray(fields.opp_id)  ? fields.opp_id[0]  : fields.opp_id;
    const itemId = Array.isArray(fields.item_id)  ? fields.item_id[0] : fields.item_id;
    const file   = Array.isArray(files.file)      ? files.file[0]     : files.file;

    if (!oppId || !file || !itemId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const docInfo = DOC_TYPES[itemId];
    if (!docInfo) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    console.log(`Processing: ${docInfo.label} for opp ${oppId}`);

    const updated = await updateGHLField(oppId, docInfo.field);
    if (!updated) {
      return res.status(500).json({ error: 'Failed to update file record. Please try again.' });
    }

    return res.status(200).json({
      success: true,
      docType: itemId,
      message: `${docInfo.label} received and logged to your file. ✓`,
    });
  } catch (err) {
    console.error('Offer upload handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
