// api/checklist.js
const FIELD_IDS = {
  sa_signing_url:           '2Gng5T7DP4LILdBC1bqT',
  portal_sa_received:       'BrrAzBKKBxVpCC8Mjfwq',
  portal_sif_received:      'MckauNwB5BGaXFfRvPwV',
  portal_mortgage_received: 'u5FQud7QCYWALMvQumjK',
  portal_3pa_received:      'ZiwfQIuYrvj16FTQc56r',
};

const ITEM_FIELD_MAP = {
  sa:       'portal_sa_received',
  sif:      'portal_sif_received',
  mortgage: 'portal_mortgage_received',
  threepa:  'portal_3pa_received',
};

export default async function handler(req, res) {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  if (!GHL_API_KEY) return res.status(500).json({ error: 'GHL_API_KEY not configured' });

  // ── GET ────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { opp_id } = req.query;
    if (!opp_id) return res.status(400).json({ error: 'opp_id is required' });

    try {
      const oppRes = await fetch(
        `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
        { headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' } }
      );
      if (!oppRes.ok) throw new Error(`GHL fetch failed: ${oppRes.status}`);

      const oppData = await oppRes.json();
      const opp     = oppData.opportunity || oppData;
      const customFields = opp.customFields || [];
      const fieldMap = {};
      for (const f of customFields) {
        fieldMap[f.id] = f.fieldValue ?? f.field_value ?? f.value ?? null;
      }

      const isComplete = (fieldId) => {
        const val = fieldMap[fieldId];
        if (Array.isArray(val)) return val.includes('Received');
        return val === 'Received';
      };

      const saSigningUrl  = fieldMap[FIELD_IDS.sa_signing_url] || '';
      const contact       = opp.contact || {};
      const contactId     = contact.id  || '';
      const fileReference = opp.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || opp_id;
      const saComplete    = isComplete(FIELD_IDS.portal_sa_received);

      let saExtra = {};
      if (!saComplete) {
        saExtra = saSigningUrl
          ? { signingUrl: saSigningUrl, buttonLabel: 'Sign Agreement' }
          : { pendingMessage: 'Your Service Agreement has been sent to your email for electronic signature. Please check your inbox and complete the signature to proceed.' };
      }

      const items = [
        { id: 'sa',       label: 'Step 1 — Service Agreement',            complete: saComplete,                                    type: 'esign',  formUrl: '', ...saExtra },
        { id: 'sif',      label: 'Step 2 — Seller Intake Form',           complete: isComplete(FIELD_IDS.portal_sif_received),      type: 'form',   pendingMessage: 'Please complete the Seller Intake Form so we can gather everything needed to process your file.', formUrl: `https://documents.shortsalestart.com/intake/${opp_id}` },
        { id: 'mortgage', label: 'Step 3 — Mortgage Statement',           complete: isComplete(FIELD_IDS.portal_mortgage_received), type: 'upload', instruction: 'Upload your most recent mortgage statement (within the last 30 days). PDF, JPG, or PNG accepted.', accept: '.pdf,.jpg,.jpeg,.png' },
        { id: 'threepa',  label: 'Step 4 — Third-Party Authorization (3PA)', complete: isComplete(FIELD_IDS.portal_3pa_received),  type: 'upload', instruction: 'Upload your signed Third-Party Authorization form. This allows LMS to communicate with your lender on your behalf.', accept: '.pdf,.jpg,.jpeg,.png' },
      ];

      return res.status(200).json({ fileReference, contactId, items });

    } catch (err) {
      console.error('[checklist GET] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST (toggle) ──────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { opp_id, item_id, received } = req.body;
    if (!opp_id || !item_id) return res.status(400).json({ error: 'Missing opp_id or item_id' });

    const fieldKey = ITEM_FIELD_MAP[item_id];
    if (!fieldKey) return res.status(400).json({ error: `Unknown item_id: ${item_id}` });

    const fieldId = FIELD_IDS[fieldKey];
    const value   = received ? ['Received'] : [];

    try {
      const oppRes = await fetch(
        `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
        { headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' } }
      );
      if (!oppRes.ok) throw new Error(`GHL fetch failed: ${oppRes.status}`);
      const oppData  = await oppRes.json();
      const opp      = oppData.opportunity || oppData;

      const updateRes = await fetch(
        `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
        {
          method:  'PUT',
          headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28', 'Content-Type': 'application/json' },
          body:    JSON.stringify({ customFields: [{ id: fieldId, field_value: value }] }),
        }
      );
      if (!updateRes.ok) {
        const errText = await updateRes.text();
        throw new Error(`GHL update failed: ${updateRes.status} — ${errText}`);
      }

      return res.status(200).json({ success: true, item_id, received });

    } catch (err) {
      console.error('[checklist POST] error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
