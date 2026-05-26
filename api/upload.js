import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = { api: { bodyParser: false } };

const DOC_TYPES = {
  sa:       { label: 'Service Agreement',            field: 'portal_sa_received' },
  sif:      { label: 'Seller Intake Form',           field: 'portal_sif_received' },
  mortgage: { label: 'Mortgage Statement',           field: 'portal_mortgage_statement_received' },
  threepa:  { label: 'Third-Party Authorization',   field: 'portal_3pa_received' },
};

async function classifyDocument(fileBuffer, filename) {
  try {
    const base64 = fileBuffer.toString('base64');
    const isPdf  = filename.toLowerCase().endsWith('.pdf');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-opus-4-5',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: [
            {
              type: isPdf ? 'document' : 'image',
              source: {
                type:       'base64',
                media_type: isPdf ? 'application/pdf' : 'image/jpeg',
                data:       base64,
              },
            },
            {
              type: 'text',
              text: 'Classify this document. Reply with ONLY one of these exact words: sa, sif, mortgage, threepa, unknown\n\nsa = Service Agreement or contract\nsif = Seller Intake Form or seller information form\nmortgage = Mortgage statement or loan statement\nthreepa = Third-party authorization or 3PA form\nunknown = anything else',
            },
          ],
        }],
      }),
    });

    const data   = await response.json();
    const result = data.content?.[0]?.text?.trim().toLowerCase();
    return DOC_TYPES[result] ? result : 'unknown';
  } catch (err) {
    console.error('Claude classification error:', err);
    return 'unknown';
  }
}

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
          customFields: [{ key: fieldKey, field_value: true }],
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

    const oppId     = Array.isArray(fields.opp_id)     ? fields.opp_id[0]     : fields.opp_id;
    const contactId = Array.isArray(fields.contact_id) ? fields.contact_id[0] : fields.contact_id;
    const file      = Array.isArray(files.file)        ? files.file[0]        : files.file;

    if (!oppId || !file) {
      return res.status(400).json({ error: 'Missing opp_id or file' });
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const filename   = file.originalFilename || 'upload';

    console.log(`Processing upload: ${filename} for opp ${oppId}`);

    const docType = await classifyDocument(fileBuffer, filename);
    console.log(`Classified as: ${docType}`);

    if (docType === 'unknown') {
      return res.status(200).json({
        success: false,
        error:   'We couldn\'t identify this document type. Please make sure you\'re uploading the correct file.',
      });
    }

    const docInfo = DOC_TYPES[docType];
    const updated = await updateGHLField(oppId, docInfo.field);

    if (!updated) {
      return res.status(500).json({ error: 'Failed to update file record. Please try again.' });
    }

    return res.status(200).json({
      success:  true,
      docType,
      message:  `${docInfo.label} received and added to your file. ✓`,
    });

  } catch (err) {
    console.error('Upload handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
