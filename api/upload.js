// api/upload.js
// Handles document uploads from the seller portal.
// 1. Sets the GHL opportunity flag to ["Received"]
// 2. Uploads the file to GHL media library (attached to contact)
// 3. Logs file receipt + download URL as a note on the contact

import formidable from 'formidable';
import fs from 'fs';

export const config = { api: { bodyParser: false } };

const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';

const DOC_TYPES = {
  sa:       { label: 'Service Agreement',          field: 'portal_sa_received' },
  sif:      { label: 'Seller Intake Form',         field: 'portal_sif_received' },
  mortgage: { label: 'Mortgage Statement',         field: 'portal_mortgage_statement_received' },
  threepa:  { label: 'Third-Party Authorization', field: 'portal_3pa_received' },
};

const GHL_HEADERS = (apiKey) => ({
  Authorization: `Bearer ${apiKey}`,
  Version: '2021-07-28',
});

async function getContactIdFromOpp(oppId, apiKey) {
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${oppId}`,
      { headers: GHL_HEADERS(apiKey) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.opportunity?.contact?.id || null;
  } catch (err) {
    console.error('[upload] getContactId error:', err);
    return null;
  }
}

async function updateGHLField(oppId, fieldKey, apiKey) {
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${oppId}`,
      {
        method: 'PUT',
        headers: { ...GHL_HEADERS(apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customFields: [{ key: fieldKey, field_value: ["Received"] }],
        }),
      }
    );
    const data = await res.json();
    console.log('[upload] GHL flag update:', JSON.stringify(data).slice(0, 200));
    return res.ok;
  } catch (err) {
    console.error('[upload] GHL flag update error:', err);
    return false;
  }
}

async function uploadFileToGHL(contactId, file, docLabel, apiKey) {
  try {
    const fileBuffer = fs.readFileSync(file.filepath);
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([fileBuffer], { type: file.mimetype || 'application/pdf' }),
      file.originalFilename || `${docLabel}.pdf`
    );
    formData.append('locationId', GHL_LOCATION_ID);
    formData.append('contactId', contactId);

    const res = await fetch(
      'https://services.leadconnectorhq.com/medias/upload-file',
      {
        method: 'POST',
        headers: GHL_HEADERS(apiKey),
        body: formData,
      }
    );
    const txt = await res.text();
    console.log('[upload] GHL media upload response:', res.status, txt.slice(0, 300));

    // Parse URL from response
    let fileUrl = null;
    try {
      const parsed = JSON.parse(txt);
      fileUrl = parsed.url || parsed.fileUrl || parsed.mediaUrl || parsed.data?.url || null;
    } catch (_) {}

    return { ok: res.ok, body: txt, fileUrl };
  } catch (err) {
    console.error('[upload] media upload error:', err);
    return { ok: false, body: err.message, fileUrl: null };
  }
}

async function addNoteToContact(contactId, noteBody, apiKey) {
  try {
    const res = await fetch(
      `https://services.leadconnectorhq.com/contacts/${contactId}/notes`,
      {
        method: 'POST',
        headers: { ...GHL_HEADERS(apiKey), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteBody }),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      console.warn('[upload] note creation failed:', txt);
    }
  } catch (err) {
    console.error('[upload] note error:', err);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GHL_API_KEY = process.env.GHL_API_KEY;
  if (!GHL_API_KEY) return res.status(500).json({ error: 'GHL_API_KEY not configured' });

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

    console.log(`[upload] Processing: ${docInfo.label} for opp ${oppId}`);

    // ── 1. Set GHL flag ───────────────────────────────────────────────────
    const flagged = await updateGHLField(oppId, docInfo.field, GHL_API_KEY);
    if (!flagged) {
      return res.status(500).json({ error: 'Failed to update file record. Please try again.' });
    }

    // ── 2. Get contact ID ─────────────────────────────────────────────────
    const contactId = await getContactIdFromOpp(oppId, GHL_API_KEY);
    if (!contactId) {
      console.warn('[upload] Could not resolve contactId — file not stored');
      return res.status(200).json({
        success: true,
        docType: itemId,
        message: `${docInfo.label} received and added to your file. ✓`,
      });
    }

    // ── 3. Upload file to GHL media library ───────────────────────────────
    const now = new Date();
    const edtTime = new Date(now.getTime() + (-4 * 60) * 60000);
    const edtString = edtTime.toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }) + ' EDT';

    const upload = await uploadFileToGHL(contactId, file, docInfo.label, GHL_API_KEY);

    // ── 4. Add note to contact ────────────────────────────────────────────
    let noteBody;
    if (upload.ok) {
      const fileRef = upload.fileUrl
        ? `File: ${upload.fileUrl}`
        : `File: stored in GHL media library (no direct URL returned)`;
      noteBody = [
        `📎 ${docInfo.label} — UPLOADED VIA PORTAL`,
        `Uploaded: ${edtString}`,
        fileRef,
        `Opportunity ID: ${oppId}`,
      ].join('\n');
    } else {
      noteBody = [
        `⚠️ ${docInfo.label} — FLAG SET BUT FILE UPLOAD FAILED`,
        `Attempted: ${edtString}`,
        `Error: ${upload.body.slice(0, 200)}`,
      ].join('\n');
    }

    await addNoteToContact(contactId, noteBody, GHL_API_KEY);

    return res.status(200).json({
      success: true,
      docType: itemId,
      message: `${docInfo.label} received and added to your file. ✓`,
    });

  } catch (err) {
    console.error('[upload] handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
