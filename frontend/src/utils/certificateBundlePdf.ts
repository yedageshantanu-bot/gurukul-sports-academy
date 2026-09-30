import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  CertificateData,
  generateMartialArtsCertificatePdf,
  cleanPdfText,
} from './certificatePdfGenerator';

/**
 * Formats user-provided range labels (e.g. '2024-01-01_to_2024-03-31') into human-readable date text.
 */
function formatDisplayDateRange(range?: string): string {
  if (!range || range.toLowerCase() === 'all') {
    return 'All Examination Sessions (Complete Registry)';
  }

  const formatDateStr = (s: string) => {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (range.includes('_to_')) {
    const [start, end] = range.split('_to_');
    return `${formatDateStr(start)} to ${formatDateStr(end)}`;
  }
  if (range.startsWith('from_')) {
    return `From ${formatDateStr(range.replace('from_', ''))}`;
  }
  if (range.startsWith('until_')) {
    return `Until ${formatDateStr(range.replace('until_', ''))}`;
  }
  return range.replace(/_/g, ' ');
}

/**
 * Generates a unified multi-page PDF containing a branded Cover Page
 * followed by each student's official martial arts promotion certificate.
 *
 * Each certificate is rendered identically to generateMartialArtsCertificatePdf
 * on its own A4 Landscape page.
 */
export async function generateCombinedCertificatesPdf(
  certs: CertificateData[],
  dateRange?: string
): Promise<Uint8Array> {
  const combinedDoc = await PDFDocument.create();

  // A4 Landscape dimensions (points)
  const width = 841.89;
  const height = 595.28;

  // Embed standard typography fonts
  const fontBold = await combinedDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await combinedDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await combinedDoc.embedFont(StandardFonts.TimesRomanItalic);

  // ---------------------------------------------------------------------------
  // COVER PAGE (A4 Landscape, consistent with certificates)
  // ---------------------------------------------------------------------------
  const coverPage = combinedDoc.addPage([width, height]);

  // Parchment Cream Background
  coverPage.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.996, 0.992, 0.976),
  });

  // Layer 1: Outermost Deep Navy Border
  coverPage.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    borderColor: rgb(15 / 255, 23 / 255, 42 / 255),
    borderWidth: 2.5,
  });

  // Layer 2: Ornate Gold Inner Border
  coverPage.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: rgb(217 / 255, 119 / 255, 6 / 255),
    borderWidth: 1,
  });

  // Decorative Corner Squares (Navy + Gold)
  const cornerSize = 10;
  const cornerOffsets = [
    { x: 26, y: 26 },
    { x: width - 26 - cornerSize, y: 26 },
    { x: 26, y: height - 26 - cornerSize },
    { x: width - 26 - cornerSize, y: height - 26 - cornerSize },
  ];
  cornerOffsets.forEach((pos) => {
    coverPage.drawRectangle({
      x: pos.x,
      y: pos.y,
      width: cornerSize,
      height: cornerSize,
      color: rgb(217 / 255, 119 / 255, 6 / 255),
    });
  });

  // Header Eyebrow
  const eyebrowText = cleanPdfText('-- GURUKUL SPORTS ACADEMY --');
  const eyebrowWidth = fontBold.widthOfTextAtSize(eyebrowText, 12);
  coverPage.drawText(eyebrowText, {
    x: (width - eyebrowWidth) / 2,
    y: 520,
    size: 12,
    font: fontBold,
    color: rgb(180 / 255, 83 / 255, 9 / 255),
  });

  // Title: Gurukul Sports Academy — Rank Promotion Certificate Bundle
  const mainTitle = 'Gurukul Sports Academy — Rank Promotion Certificate Bundle';
  const mainTitleClean = cleanPdfText(mainTitle);
  const titleWidth = fontBold.widthOfTextAtSize(mainTitleClean, 22);
  coverPage.drawText(mainTitleClean, {
    x: (width - titleWidth) / 2,
    y: 480,
    size: 22,
    font: fontBold,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });

  // Subtitle
  const subTitleText = cleanPdfText('OFFICIAL MARTIAL ARTS & COMBAT SPORTS BELT REGISTRY ARCHIVE');
  const subWidth = fontBold.widthOfTextAtSize(subTitleText, 9.5);
  coverPage.drawText(subTitleText, {
    x: (width - subWidth) / 2,
    y: 456,
    size: 9.5,
    font: fontBold,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });

  // Central Gold Accent Divider
  const dividerLength = 360;
  coverPage.drawLine({
    start: { x: (width - dividerLength) / 2, y: 440 },
    end: { x: (width + dividerLength) / 2, y: 440 },
    thickness: 1.5,
    color: rgb(217 / 255, 119 / 255, 6 / 255),
  });

  // ---------------------------------------------------------------------------
  // Central Metadata Summary Card
  // ---------------------------------------------------------------------------
  const cardX = 160;
  const cardY = 135;
  const cardWidth = width - 320;
  const cardHeight = 280;

  // Card Background
  coverPage.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(226 / 255, 232 / 255, 240 / 255),
    borderWidth: 1.2,
  });

  // Card Header Band
  coverPage.drawRectangle({
    x: cardX,
    y: cardY + cardHeight - 38,
    width: cardWidth,
    height: 38,
    color: rgb(248 / 255, 250 / 255, 252 / 255),
    borderColor: rgb(226 / 255, 232 / 255, 240 / 255),
    borderWidth: 1,
  });

  const cardHeader = cleanPdfText('BUNDLE SUMMARY & EXAMINATION ROSTER');
  coverPage.drawText(cardHeader, {
    x: cardX + 20,
    y: cardY + cardHeight - 24,
    size: 11,
    font: fontBold,
    color: rgb(30 / 255, 41 / 255, 59 / 255),
  });

  // Formatted metadata strings
  const formattedRange = cleanPdfText(formatDisplayDateRange(dateRange));
  const generatedTimestamp = cleanPdfText(
    `${new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })} at ${new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  );

  const uniqueDisciplines = cleanPdfText(
    Array.from(
      new Set(
        certs
          .map((c) => c.discipline_name || c.disciplineName)
          .filter(Boolean)
      )
    ).join(', ') || 'Martial Arts & Athletics'
  );

  // Metadata Table Rows inside Card
  const rows: Array<{ label: string; value: string; isBoldVal?: boolean; colorVal?: any }> = [
    {
      label: 'Total Certificates Compiled:',
      value: `${certs.length} Certificate${certs.length === 1 ? '' : 's'}`,
      isBoldVal: true,
      colorVal: rgb(180 / 255, 83 / 255, 9 / 255),
    },
    {
      label: 'Examination Date Window:',
      value: formattedRange,
      isBoldVal: true,
      colorVal: rgb(15 / 255, 23 / 255, 42 / 255),
    },
    {
      label: 'Generated Timestamp:',
      value: generatedTimestamp,
      isBoldVal: false,
    },
    {
      label: 'Disciplines Included:',
      value: uniqueDisciplines,
      isBoldVal: false,
    },
    {
      label: 'Issuing Authority:',
      value: 'Gurukul Sports Academy Central Dojo & Examination Board',
      isBoldVal: false,
    },
  ];

  let currentY = cardY + cardHeight - 65;
  rows.forEach((r) => {
    // Label
    coverPage.drawText(cleanPdfText(r.label), {
      x: cardX + 22,
      y: currentY,
      size: 9.5,
      font: fontBold,
      color: rgb(71 / 255, 85 / 255, 105 / 255),
    });

    // Value
    coverPage.drawText(cleanPdfText(r.value), {
      x: cardX + 215,
      y: currentY,
      size: 9.5,
      font: r.isBoldVal ? fontBold : fontRegular,
      color: r.colorVal || rgb(15 / 255, 23 / 255, 42 / 255),
    });

    // Subtle divider
    coverPage.drawLine({
      start: { x: cardX + 20, y: currentY - 8 },
      end: { x: cardX + cardWidth - 20, y: currentY - 8 },
      thickness: 0.5,
      color: rgb(241 / 255, 245 / 255, 249 / 255),
    });

    currentY -= 28;
  });

  // Explanatory note in card footer
  const note1 = cleanPdfText(
    '* Each subsequent page contains an authentic, individually verified A4 landscape certificate.'
  );
  const note2 = cleanPdfText(
    'Suitable for direct color printing, student handovers, and permanent institutional records.'
  );
  coverPage.drawText(note1, {
    x: cardX + 22,
    y: cardY + 36,
    size: 8,
    font: fontItalic,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });
  coverPage.drawText(note2, {
    x: cardX + 22,
    y: cardY + 22,
    size: 8,
    font: fontItalic,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });

  // Footer Security Bar
  const footerText = cleanPdfText(
    'Official Gurukul Sports Academy Credential Document | Verified by Certificate Registry Engine'
  );
  const footWidth = fontRegular.widthOfTextAtSize(footerText, 7.5);
  coverPage.drawText(footerText, {
    x: (width - footWidth) / 2,
    y: 38,
    size: 7.5,
    font: fontRegular,
    color: rgb(148 / 255, 163 / 255, 184 / 255),
  });

  // ---------------------------------------------------------------------------
  // APPEND CERTIFICATE PAGES
  // Render each certificate via generateMartialArtsCertificatePdf and copy pages
  // ---------------------------------------------------------------------------
  for (const cert of certs) {
    const singlePdfBytes = await generateMartialArtsCertificatePdf(cert);
    const srcDoc = await PDFDocument.load(singlePdfBytes);
    const pageIndices = srcDoc.getPageIndices();
    const copiedPages = await combinedDoc.copyPages(srcDoc, pageIndices);
    for (const page of copiedPages) {
      combinedDoc.addPage(page);
    }
  }

  return await combinedDoc.save();
}

/**
 * Downloads a combined multi-page PDF bundle directly to the user's browser.
 * Filename format: Gurukul_Certificates_Bundle_<label>.pdf
 */
export async function downloadCombinedCertificatesPdf(
  certs: CertificateData[],
  label?: string
): Promise<void> {
  const pdfBytes = await generateCombinedCertificatesPdf(certs, label);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const safeLabel = (label || 'all')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50);
  const fileName = `Gurukul_Certificates_Bundle_${safeLabel}.pdf`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
