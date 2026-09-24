const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

const { DEFAULT_LAYOUT } = require("../validators/certificates.validator");

// ── Certificate PDF renderer (pdfkit — no headless browser, no remote fetches
// except the instructor's own uploaded design image, fetched from OUR bucket
// via a URL we generated ourselves at confirm-time — never arbitrary
// user-supplied input, so this isn't the SSRF DEFAULT_LAYOUT's own comment
// used to justify keeping v1 logo-free) ──────────────────────────────────────
//
// Everything drawn here is either validated layout data or DB-snapshotted text;
// pdfkit draws text literally (no markup interpretation), so placeholder values
// need no escaping. The QR encodes the public verify URL; the async QR render
// happens BEFORE piping starts so any failure is still a clean JSON error.

const PLACEHOLDERS = ["studentName", "courseTitle", "date"];

// Matches any {{token}}-shaped text left after known placeholders are
// substituted — e.g. a mistyped {{bilal}}. Stripped so a template typo never
// prints raw placeholder syntax on an issued certificate.
const UNRECOGNIZED_PLACEHOLDER = /\{\{[^{}]*\}\}/g;

// Caps the custom-design PDF page at a sane point size regardless of the
// uploaded image's native pixel resolution (a 6000px photo would otherwise
// produce an 80+ inch page). nameX/nameY stay correct at any scale — they're
// fractions of the page, not pixel offsets.
const MAX_DESIGN_DIM = 1600;
const IMAGE_FETCH_TIMEOUT_MS = 8000;

function fillPlaceholders(text, values) {
  let out = text;
  for (const key of PLACEHOLDERS) {
    out = out.split(`{{${key}}}`).join(values[key] ?? "");
  }
  return out.replace(UNRECOGNIZED_PLACEHOLDER, "");
}

function verifyUrlFor(code) {
  const base = (process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${base}/verify/${code}`;
}

async function fetchImageBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

// `autoFirstPage: false` means this throwaway doc never actually opens a
// page — it exists only so pdfkit's image decoder can tell us the uploaded
// design's native pixel dimensions before the REAL doc (whose page size
// depends on that answer) gets created.
function imageDimensions(buffer) {
  const probe = new PDFDocument({ autoFirstPage: false });
  const img = probe.openImage(buffer);
  return { width: img.width, height: img.height };
}

function renderCustomDesign(res, imageBuffer, design, studentName) {
  const { width: rawW, height: rawH } = imageDimensions(imageBuffer);
  const scale = Math.min(1, MAX_DESIGN_DIM / Math.max(rawW, rawH));
  const pageW = Math.max(1, Math.round(rawW * scale));
  const pageH = Math.max(1, Math.round(rawH * scale));

  const doc = new PDFDocument({ size: [pageW, pageH], margin: 0 });
  doc.pipe(res);

  doc.image(imageBuffer, 0, 0, { width: pageW, height: pageH });

  const fontSize = design.fontSize ?? 28;
  const nameX = design.nameX ?? 0.5;
  const nameY = design.nameY ?? 0.5;

  doc.font("Helvetica-Bold").fontSize(fontSize).fillColor(design.color ?? "#000000");
  const textWidth = doc.widthOfString(studentName);
  doc.text(studentName, nameX * pageW - textWidth / 2, nameY * pageH - fontSize / 2, { lineBreak: false });

  doc.end();
}

async function renderDefaultLayout(res, cert, values) {
  const layout = { ...DEFAULT_LAYOUT, ...(cert.layout ?? {}) };

  // Rendered BEFORE piping starts (same rule as before this file grew a
  // second layout branch) — a QR failure must still surface as a clean JSON
  // error, not a half-written PDF stream.
  const qrPng = await QRCode.toBuffer(verifyUrlFor(cert.verificationCode), { width: 110, margin: 1 });

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

/**
 * Streams the certificate PDF into `res`. Call only after all lookups have
 * succeeded — headers are written here.
 * cert: { studentName, courseTitle, issuedAt, verificationCode, layout|null,
 *         customDesign: { imageUrl, nameX, nameY, fontSize, color } | null }
 */
async function renderCertificatePdf(res, cert) {
  const issued = cert.issuedAt instanceof Date ? cert.issuedAt : new Date(cert.issuedAt);
  const values = {
    studentName: cert.studentName ?? "Student",
    courseTitle: cert.courseTitle ?? "Course",
    date: issued.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
  };

  res.setHeader("Content-Type", "application/pdf");
  // verificationCode is validated hex — safe in a header.
  res.setHeader("Content-Disposition", `inline; filename="certificate-${cert.verificationCode}.pdf"`);

  if (cert.customDesign) {
    try {
      const imageBuffer = await fetchImageBuffer(cert.customDesign.imageUrl);
      renderCustomDesign(res, imageBuffer, cert.customDesign, values.studentName);
      return;
    } catch (err) {
      // Falls through to the default layout below — a storage hiccup on the
      // custom design must never turn into a 500 for an otherwise-valid
      // certificate. Headers above are safe to keep: neither branch has
      // written a body byte yet at this point.
      console.error("[certificatePdf.service] custom design render failed, falling back to DEFAULT_LAYOUT:", err.message);
    }
  }

  await renderDefaultLayout(res, cert, values);
}

module.exports = { renderCertificatePdf };
