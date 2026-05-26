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
    const opp = data.opportunity || data;
    const customFields = opp.customFields || [];
    const contactEmail = opp.contact?.email || '';

    const getField = (key) => {
      const f = customFields.find(f => f.key === key || f.fieldKey === key);
      if (!f) return false;
      return f.value === true || f.value === 'true' || f.value === '1' || f.value === 1;
    };

    const getFieldValue = (key) => {
      const f = customFields.find(f => f.key === key || f.fieldKey === key);
      return f?.value || '';
    };

    const saSigningUrl = getFieldValue('sa_signing_url');

    return res.status(200).json({
      fileReference: opp.name || 'File ' + opp_id,
      contactId: opp.contactId || opp.contact?.id || '',
      items: [
        {
          id: 'sa',
          label: 'Step 1 — Service Agreement',
          complete: getField('portal_sa_received'),
          type: saSigningUrl ? 'form' : 'esign',
          pendingMessage: saSigningUrl ? 'Please sign your Service Agreement to proceed. This authorizes LMS to begin processing your short sale file.' : 'Your Service Agreement has been sent to your email for electronic signature. Please check your inbox and complete the signature to proceed.',
          formUrl: saSigningUrl || ''
        },
        {
          id: 'sif',
          label: 'Step 2 — Seller Intake Form',
          complete: getField('portal_sif_received'),
          type: 'form',
          pendingMessage: 'Please complete the Seller Intake Form so we can gather everything needed to process your file.',
          formUrl: `https://api.leadconnectorhq.com/widget/form/${process.env.GHL_SIF_FORM_ID}?email=${contactEmail}`
        },
        {
          id: 'mortgage',
          label: 'Step 3 — Mortgage Statement',
          complete: getField('portal_mortgage_statement_received'),
          type: 'upload',
          instruction: 'Upload your most recent mortgage statement (within the last 30 days). PDF, JPG, or PNG accepted.',
          accept: '.pdf,.jpg,.jpeg,.png'
        },
        {
          id: 'threepa',
          label: 'Step 4 — Third-Party Authorization (3PA)',
          complete: getField('portal_3pa_received'),
          type: 'upload',
          instruction: 'Upload your signed Third-Party Authorization form. This allows LMS to communicate with your lender on your behalf.',
          accept: '.pdf,.jpg,.jpeg,.png'
        }
      ]
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
