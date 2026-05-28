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

    (data.initials || []).forEach((i
