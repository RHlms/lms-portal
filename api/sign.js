// api/sign.js
// Processes Service Agreement submission.
// 1. Marks portal_sa_received = ["Received"] on opportunity
// 2. Generates signed SA execution record PDF via PDFKit
// 3. Uploads PDF to GHL media library
// 4. Writes timestamped audit note with PDF URL to contact

import PDFDocument from 'pdfkit';

const GHL_LOCATION_ID = 'SmS67ZUDphr7uhGrsQGm';

const GHL_HEADERS = (apiKey) => ({
  Authorization: `Bearer ${apiKey}`,
  Version: '2021-07-28',
});

// ── PDF Generation ─────────────────────────────────────────────────────────
function generateSAPdf(data) {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'LETTER' });
    const chunks = [];
    doc.on('data',  chunk => chunks.push(chunk));
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const TEAL  = '#00A8C6';
    const NAVY  = '#0B1F3A';
    const GRAY  = '#4a6a85';
    const WHITE = '#ffffff';
    const LIGHT = '#f0f9fb';

    // ── Page header helper ───────────────────────────────────────────────
    function drawHeader() {
      doc.fillColor(TEAL).rect(50, 45, 515, 4).fill();
      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(18)
         .text('LOAN MITIGATION SERVICES, LLC', 50, 60);
      doc.fillColor(GRAY).font('Helvetica').fontSize(9)
         .text('151 Southhall Lane Ste 230  |  Maitland, FL 32751  |  info@shortsalestart.com', 50, 83);
      doc.fillColor(TEAL).rect(50, 96, 515, 2).fill();
    }

    drawHeader();

    // ── Title ────────────────────────────────────────────────────────────
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14)
       .text('SERVICE AGREEMENT — ELECTRONICALLY EXECUTED', 50, 110, { align: 'center', width: 515 });

    // ── Execution details box ────────────────────────────────────────────
    const boxY = 135;
    doc.fillColor(LIGHT).roundedRect(50, boxY, 515, 100, 6).fill();
    doc.strokeColor(TEAL).lineWidth(1).roundedRect(50, boxY, 515, 100, 6).stroke();
    doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(9)
       .text('EXECUTION DETAILS', 65, boxY + 10);

    const execFields = [
      ['Signer',     data.borrower_name],
      ['Signed',     data.timestampET],
      ['Property',   data.property_address || '—'],
      ['IP Address', data.ip],
      ['Opp ID',     data.opp_id],
    ];
    execFields.forEach(([label, value], i) => {
      const fy = boxY + 26 + (i * 14);
      doc.fillColor(GRAY).font('Helvetica').fontSize(9).text(label + ':', 65, fy, { width: 75, continued: false });
      doc.fillColor(NAVY).font('Helvetica').fontSize(9).text(String(value || '—'), 145, fy, { width: 410 });
    });

    // ── Forms section ────────────────────────────────────────────────────
    let curY = boxY + 115;
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
       .text('FORMS ACKNOWLEDGED', 50, curY);
    curY += 16;

    const forms = [
      { num: '1', title: 'Borrower / Co-Borrower Commitment' },
      { num: '2', title: "Homeowner's Right to Cancel" },
      { num: '3', title: 'Hold-Harmless Acknowledgement' },
      { num: '4', title: 'Authorization to Furnish – TILA-RESPA' },
      { num: '5', title: '"For Sale" Lender Requirement' },
      { num: '6', title: 'Foreclosure Acknowledgement' },
      { num: '7', title: 'Alternatives to Foreclosure Acknowledgement' },
      { num: '8', title: '"Processing Fee" Acknowledgment' },
      { num: '9', title: '"Relocation Assistance" Acknowledgement' },
    ];

    forms.forEach(form => {
      if (curY > 700) { doc.addPage(); drawHeader(); curY = 115; }

      doc.fillColor('#f8fbfc').rect(50, curY, 515, 28).fill();
      doc.strokeColor('#d1dde8').lineWidth(0.5).rect(50, curY, 515, 28).stroke();

      doc.fillColor(TEAL).roundedRect(56, curY + 5, 52, 16, 3).fill();
      doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8)
         .text(`FORM ${form.num}`, 56, curY + 9, { width: 52, align: 'center' });

      doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(9)
         .text(form.title, 116, curY + 5, { width: 280 });

      doc.fillColor(GRAY).font('Helvetica').fontSize(8)
         .text(`Acknowledged: ${data.borrower_name}`, 116, curY + 17, { width: 240 });
      doc.fillColor(GRAY).font('Helvetica').fontSize(8)
         .text(data.signDate, 400, curY + 17);

      curY += 30;
    });

    curY += 10;

    // ── Form 8 Initials ──────────────────────────────────────────────────
    if (curY > 650) { doc.addPage(); drawHeader(); curY = 115; }

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
       .text('FORM 8 — PROCESSING FEE INITIALS', 50, curY);
    curY += 16;

    const initLabels = [
      'Overall goal: process short-sale and obtain Approval Letter',
      'LMS processes documents; does not negotiate price or terms',
      'Short-sale processing is demanding and may take several months',
      'LMS processing fee of $4,950 — paid by Lender or Buyer',
      'Cancellation: borrower responsibility if canceling after 30 days',
      'Invoice and NOI rights if fee not paid within 30 days of invoice',
    ];

    (data.initials || []).forEach((initial, i) => {
      if (curY > 700) { doc.addPage(); drawHeader(); curY = 115; }

      doc.fillColor('#f8fbfc').rect(50, curY, 515, 22).fill();
      doc.strokeColor('#d1dde8').lineWidth(0.5).rect(50, curY, 515, 22).stroke();

      doc.fillColor(TEAL).font('Helvetica-Bold').fontSize(11)
         .text(initial || '—', 58, curY + 5, { width: 45, align: 'center' });
      doc.fillColor(NAVY).font('Helvetica').fontSize(8)
         .text(initLabels[i] || '', 112, curY + 7, { width: 445 });

      curY += 24;
    });

    curY += 10;

    // ── Form 5 Listing Agent ─────────────────────────────────────────────
    if (curY > 650) { doc.addPage(); drawHeader(); curY = 115; }

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
       .text('FORM 5 — LISTING AGENT', 50, curY);
    curY += 14;

    if (data.listing_agent_option === 'has_agent') {
      const agentRows = [
        ['Name',      data.listing_agent_name],
        ['Brokerage', data.listing_agent_brokerage],
        ['Phone',     data.listing_agent_phone],
        ['Email',     data.listing_agent_email],
      ];
      agentRows.forEach(([label, value]) => {
        doc.fillColor(GRAY).font('Helvetica').fontSize(9).text(label + ':', 65, curY, { width: 80 });
        doc.fillColor(NAVY).font('Helvetica').fontSize(9).text(value || '—', 150, curY, { width: 380 });
        curY += 14;
      });
    } else {
      doc.fillColor(NAVY).font('Helvetica').fontSize(9)
         .text('No listing agent — referral requested', 65, curY);
      curY += 14;
    }

    curY += 10;

    // ── Form 4 Buyer ─────────────────────────────────────────────────────
    if (curY > 700) { doc.addPage(); drawHeader(); curY = 115; }

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(11)
       .text('FORM 4 — TILA-RESPA', 50, curY);
    curY += 14;
    doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('Buyer Name:', 65, curY, { width: 80 });
    doc.fillColor(NAVY).font('Helvetica').fontSize(9).text(data.buyer_name || 'N/A', 150, curY);
    curY += 20;

    // ── Audit footer ─────────────────────────────────────────────────────
    if (curY > 700) { doc.addPage(); drawHeader(); curY = 115; }

    doc.fillColor(TEAL).rect(50, curY, 515, 1).fill();
    curY += 8;

    doc.fillColor(GRAY).font('Helvetica').fontSize(8)
       .text(`Timestamp (UTC): ${data.timestampUTC}`, 50, curY);
    curY += 12;
    doc.text(`Browser: ${data.userAgent}`, 50, curY);
    curY += 12;
    doc.text(`Executed via LMS Seller Portal at documents.shortsalestart.com`, 50, curY);
    curY += 16;

    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8)
       .text(
         'This is an official electronic execution record generated by Loan Mitigation Services, LLC.',
         50, curY, { align: 'center', width: 515 }
       );

    doc.end();
  });
}

// ── Upload PDF to GHL media ────────────────────────────────────────────────
async function uploadPdfToGHL(contactId, pdfBuffer, filename, apiKey) {
  try {
    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), filename);
    formData.append('locationId', GHL_LOCATION_ID);
    formData.append('contactId', contactId);

    const res = await fetch(
      'https://services.leadconnectorhq.com/medias/upload-file',
      { method: 'POST', headers: GHL_HEADERS(apiKey), body: formData }
    );
    const txt = await res.text();
    console.log('[sign] PDF upload response:', res.status, txt.slice(0, 300));

    let fileUrl = null;
    try {
      const parsed = JSON.parse(txt);
      fileUrl = parsed.url || parsed.fileUrl || parsed.mediaUrl || parsed.data?.url || null;
    } catch (_) {}

    return { ok: res.ok, fileUrl };
  } catch (err) {
    console.error('[sign] PDF upload error:', err);
    return { ok: false, fileUrl: null };
  }
}

// ── Handler ────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GHL_API_KEY = process.env.GHL_API_KEY;
  if (!GHL_API_KEY) return res.status(500).json({ error: 'GHL_API_KEY not configured' });

  const {
    opp_id, contact_id, borrower_name, buyer_name,
    listing_agent_option, listing_agent_name, listing_agent_brokerage,
    listing_agent_phone, listing_agent_email, initials,
  } = req.body;

  if (!opp_id || !borrower_name) {
    return res.status(400).json({ error: 'opp_id and borrower_name required' });
  }

  const ip        = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const now       = new Date();

  const timestampUTC = now.toISOString();
  const timestampET  = now.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'long' });
  const signDate     = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' });

  const JSON_HEADERS = {
    Authorization: `Bearer ${GHL_API_KEY}`,
    Version: '2021-07-28',
    'Content-Type': 'application/json',
  };

  const errors = [];

  // ── 1. Mark portal_sa_received ──────────────────────────────────────────
  try {
    const oppRes = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ customFields: [{ key: 'portal_sa_received', field_value: ['Received'] }] }),
      }
    );
    if (!oppRes.ok) errors.push(`opp update failed: ${await oppRes.text()}`);
  } catch (err) {
    errors.push(`opp update error: ${err.message}`);
  }

  // ── 2. Fetch property address ───────────────────────────────────────────
  let property_address = '—';
  try {
    const r = await fetch(
      `https://services.leadconnectorhq.com/opportunities/${opp_id}`,
      { headers: GHL_HEADERS(GHL_API_KEY) }
    );
    if (r.ok) {
      const d = await r.json();
      property_address = d.opportunity?.name || '—';
    }
  } catch (_) {}

  // ── 3. Generate PDF ─────────────────────────────────────────────────────
  let pdfUrl = null;
  try {
    const pdfBuffer = await generateSAPdf({
      opp_id, borrower_name, buyer_name,
      listing_agent_option, listing_agent_name,
      listing_agent_brokerage, listing_agent_phone, listing_agent_email,
      initials: initials || [],
      ip, userAgent, timestampUTC, timestampET, signDate, property_address,
    });

    if (contact_id) {
      const filename = `SA-Executed-${borrower_name.replace(/\s+/g, '-')}-${signDate.replace(/[\s,]+/g, '-')}.pdf`;
      const upload   = await uploadPdfToGHL(contact_id, pdfBuffer, filename, GHL_API_KEY);
      pdfUrl = upload.fileUrl;
    }
  } catch (err) {
    console.error('[sign] PDF error:', err);
    errors.push(`PDF error: ${err.message}`);
  }

  // ── 4. Write audit note ─────────────────────────────────────────────────
  if (contact_id) {
    const initialsLog = Array.isArray(initials)
      ? initials.map((v, i) => `  Form 8 — Item ${i + 1}: "${v}"`).join('\n')
      : '';

    const agentLog = listing_agent_option === 'has_agent'
      ? `  Name: ${listing_agent_name}\n  Brokerage: ${listing_agent_brokerage}\n  Phone: ${listing_agent_phone}\n  Email: ${listing_agent_email}`
      : '  No listing agent — referral requested';

    const pdfLine = pdfUrl
      ? `Signed SA PDF: ${pdfUrl}`
      : 'Signed SA PDF: generation failed — see Vercel logs';

    const auditBody = [
      '✅ LMS SERVICE AGREEMENT — ELECTRONICALLY EXECUTED',
      '',
      `Signer:          ${borrower_name}`,
      `Signed:          ${timestampET}`,
      `Timestamp (UTC): ${timestampUTC}`,
      `IP Address:      ${ip}`,
      `Browser:         ${userAgent}`,
      `Opportunity ID:  ${opp_id}`,
      pdfLine,
      '',
      'FORM 4 — TILA-RESPA:',
      `  Buyer Name: ${buyer_name || 'N/A'}`,
      '',
      'FORM 5 — LISTING AGENT:',
      agentLog,
      '',
      'FORM 8 — PROCESSING FEE INITIALS:',
      initialsLog,
    ].join('\n');

    try {
      const noteRes = await fetch(
        `https://services.leadconnectorhq.com/contacts/${contact_id}/notes`,
        { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ body: auditBody }) }
      );
      if (!noteRes.ok) errors.push(`note failed: ${await noteRes.text()}`);
    } catch (err) {
      errors.push(`note error: ${err.message}`);
    }
  }

  return res.status(200).json({ success: true, warnings: errors.length ? errors : undefined });
}
