const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const { DEFAULT_LAYOUT } = require("../validators/certificates.validator");

// ── Certificate PDF renderer (pdfkit — no headless browser, no remote fetches) ──
//
// Everything drawn here is either validated layout data or DB-snapshotted text;
// pdfkit draws text literally (no markup interpretation), so placeholder values
// need no escaping. The QR encodes the public verify URL; the async QR render
// happens BEFORE piping starts so any failure is still a clean JSON error.

const PLACEHOLDERS = ["studentName", "courseTitle", "date"];

function fillPlaceholders(text, values) {
  let out = text;
  for (const key of PLACEHOLDERS) {
    out = out.split(`{{${key}}}`).join(values[key] ?? "");
  }
  return out;
}

function verifyUrlFor(code) {
  const base = (process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/verify/${code}`;
}

/**
 * Streams the certificate PDF into `res`. Call only after all lookups have
 * succeeded — headers are written here.
 * cert: { studentName, courseTitle, issuedAt, verificationCode, layout|null }
 */
async function renderCertificatePdf(res, cert) {
  const layout = { ...DEFAULT_LAYOUT, ...(cert.layout ?? {}) };
  const issued = cert.issuedAt instanceof Date ? cert.issuedAt : new Date(cert.issuedAt);
  const values = {
    studentName: cert.studentName ?? "Student",
    courseTitle: cert.courseTitle ?? "Course",
    date: issued.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  };

  const qrPng = await QRCode.toBuffer(verifyUrlFor(cert.verificationCode), { width: 110, margin: 1 });

  res.setHeader("Content-Type", "application/pdf");
  // verificationCode is validated hex — safe in a header.
  res.setHeader("Content-Disposition", `inline; filename="certificate-${cert.verificationCode}.pdf"`);

  const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
  doc.pipe(res);

  const W = doc.page.width;   // 841.89
  const H = doc.page.height;  // 595.28

  // Double border: outer primary, inner accent.
  doc.lineWidth(3).strokeColor(layout.primaryColor).rect(24, 24, W - 48, H - 48).stroke();
  doc.lineWidth(1).strokeColor(layout.accentColor).rect(34, 34, W - 68, H - 68).stroke();

  // Title + accent rule.
  doc.font("Helvetica-Bold").fontSize(34).fillColor(layout.primaryColor)
     .text(layout.title, 60, 100, { width: W - 120, align: "center" });
  const ruleY = 160;
  doc.lineWidth(2).strokeColor(layout.accentColor)
     .moveTo(W / 2 - 120, ruleY).lineTo(W / 2 + 120, ruleY).stroke();

  // Student name — the centerpiece.
  doc.font("Helvetica-Bold").fontSize(28).fillColor("#111111")
     .text(values.studentName, 60, 210, { width: W - 120, align: "center" });

  // Body with placeholders substituted.
  doc.font("Helvetica").fontSize(14).fillColor("#333333")
     .text(fillPlaceholders(layout.body, values), 140, 270, { width: W - 280, align: "center", lineGap: 4 });

  // Issue date.
  doc.font("Helvetica").fontSize(11).fillColor("#555555")
     .text(`Issued on ${values.date}`, 60, 360, { width: W - 120, align: "center" });

  // Signature block (bottom-left), only when configured.
  if (layout.signatureName) {
    const sigX = 100;
    const sigY = H - 150;
    doc.lineWidth(1).strokeColor("#999999").moveTo(sigX, sigY).lineTo(sigX + 180, sigY).stroke();
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111").text(layout.signatureName, sigX, sigY + 8, { width: 180 });
    if (layout.signatureTitle) {
      doc.font("Helvetica").fontSize(10).fillColor("#555555").text(layout.signatureTitle, sigX, sigY + 24, { width: 180 });
    }
  }

  // QR + code (bottom-right) — scan → public verify page.
  const qrX = W - 190;
  const qrY = H - 190;
  doc.image(qrPng, qrX, qrY, { width: 110 });
  doc.font("Helvetica").fontSize(7).fillColor("#777777")
     .text(cert.verificationCode, qrX - 20, qrY + 116, { width: 150, align: "center" });

  doc.end();
}

module.exports = { renderCertificatePdf };
