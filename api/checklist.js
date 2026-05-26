// api/checklist.js
// LMS Document Portal — Checklist API
//
// FIELD IDS — confirmed via /locations/{id}/customFields?model=opportunity (2026-05-26)

const FIELD_IDS = {
  sa_signing_url:           '2Gng5T7DP4LILdBC1bqT', // ✅ SA Signing URL
  portal_sa_received:       'BrrAzBKKBxVpCC8Mjfwq', // ✅ PORTAL: SA Received
  portal_sif_received:      'MckauNwB5BGaXFfRvPwV', // ✅ PORTAL: SIF Received
  portal_mortgage_received: 'u5FQud7QCYWALMvQumjK', // ✅ PORTAL: Mortgage Statement Received
  portal_3pa_received:      'ZiwfQIuYrvj16FTQc56r', // ✅ PORTAL: 3PA Received
};

export default async function handler(req, res) {
  const { opp_id } = req.query;

  if (!opp_id) {
    return res.status(400).json({ error: 'opp_id is required' });
  }

  const GHL_API_KEY     = process.env.GHL_API_KEY;
  const GHL_SIF_FORM_ID = process.env.GHL_SIF_FORM_ID;

  if (!GHL_API_KEY) {
    return res.status(500).json({ error: 'GHL_API_KEY not configured' });
  }

  try {
    // ── 1. Fetch opportunity from GHL ──────────────────────────────────────
    const oppRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      {
        headers: {
          Authorization: `Bearer ${GHL_API_KEY}`,
          Version: '2021-07-28',
        },
      }
    );

    if (!oppRes.ok) {
      const errText = await oppRes.text();
      return res.status(502).json({ error: 'GHL opportunity fetch failed', detail: errText });
    }

    const oppData = await oppRes.json();
    const opp     = oppData.opportunity || oppData;

    // ── 2. Build field value lookup map (ID → value) ───────────────────────
    const customFields = opp.customFields || [];
    const fieldMap     = {};

    for (const f of customFields) {
      fieldMap[f.id] = f.fieldValue ?? f.field_value ?? f.value ?? null;
    }

    // ── 3. Helper: is a portal checkbox field marked complete? ─────────────
    const isComplete = (fieldId) => {
      const val = fieldMap[fieldId];
      if (Array.isArray(val)) return val[0] === true || val[0] === 'true' || val[0] === 1;
      return val === true || val === 'true' || val === 1;
    };

    // ── 4. Resolve SA signing URL ──────────────────────────────────────────
    const saSigningUrl = fieldMap[FIELD_IDS.sa_signing_url] || '';

    // ── 5. Contact info for form URLs ──────────────────────────────────────
    const contact      = opp.contact || {};
    const contactEmail = contact.email || '';
    const contactId    = contact.id    || '';

    const fileReference = opp.name
      || `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
      || opp_id;

    // ── 6. Build checklist items ───────────────────────────────────────────
    const saComplete = isComplete(FIELD_IDS.portal_sa_received);

    // SA item: three states
    //   a) complete → checkmark only
    //   b) incomplete + signing URL → show button
    //   c) incomplete + no URL → email fallback message
    let saExtra = {};
    if (!saComplete) {
      if (saSigningUrl) {
        saExtra = {
          signingUrl:  saSigningUrl,
          buttonLabel: 'Sign Agreement',
        };
      } else {
        saExtra = {
          pendingMessage:
            'Your Service Agreement has been sent to your email for electronic signature. ' +
            'Please check your inbox and complete the signature to proceed.',
        };
      }
    }

    const items = [
      {
        id:       'sa',
        label:    'Step 1 — Service Agreement',
        complete: saComplete,
        type:     'esign',
        formUrl:  '',
        ...saExtra,
      },
      {
        id:             'sif',
        label:          'Step 2 — Seller Intake Form',
        complete:       isComplete(FIELD_IDS.portal_sif_received),
        type:           'form',
        pendingMessage: 'Please complete the Seller Intake Form so we can gather everything needed to process your file.',
        formUrl:        `https://api.leadconnectorhq.com/widget/form/${GHL_SIF_FORM_ID}?email=${encodeURIComponent(contactEmail)}`,
      },
      {
        id:          'mortgage',
        label:       'Step 3 — Mortgage Statement',
        complete:    isComplete(FIELD_IDS.portal_mortgage_received),
        type:        'upload',
        instruction: 'Upload your most recent mortgage statement (within the last 30 days). PDF, JPG, or PNG accepted.',
        accept:      '.pdf,.jpg,.jpeg,.png',
      },
      {
        id:          'threepa',
        label:       'Step 4 — Third-Party Authorization (3PA)',
        complete:    isComplete(FIELD_IDS.portal_3pa_received),
        type:        'upload',
        instruction: 'Upload your signed Third-Party Authorization form. This allows LMS to communicate with your lender on your behalf.',
        accept:      '.pdf,.jpg,.jpeg,.png',
      },
    ];

    // ── 7. Return ──────────────────────────────────────────────────────────
    return res.status(200).json({
      fileReference,
      contactId,
      items,
    });

  } catch (err) {
    console.error('[checklist] error:', err);
    return res.status(500).json({ error: err.message });
  }
}
