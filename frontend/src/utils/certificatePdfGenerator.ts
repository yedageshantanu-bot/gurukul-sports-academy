import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export interface CertificateData {
  id?: string;
  student_name?: string;
  playerName?: string;
  student_code?: string;
  regNumber?: string;
  dob?: string;
  fatherName?: string;
  parentName?: string;
  father_name?: string;
  parent_name?: string;
  discipline_name?: string;
  disciplineName?: string;
  to_rank_name?: string;
  rankSecured?: string;
  belt_color?: string;
  beltColor?: string;
  promoted_at?: string;
  promotionDate?: string;
  certificate_number?: string;
  certificateNumber?: string;
  examiner_name?: string;
  promotedBy?: string;
  represented_from?: string;
  representedFrom?: string;
  dojoLocation?: string;

  // Printing calibration & Field Position adjustments (in mm or points)
  printMode?: 'FULL_COLOR' | 'PLAIN_PAPER';
  offsetY?: number; // In millimeters (+/- global vertical shift)
  offsetX?: number; // In millimeters (+/- global horizontal shift)
  nameOffsetX?: number;
  nameOffsetY?: number;
  beltOffsetX?: number;
  beltOffsetY?: number;
  metaOffsetX?: number;
  metaOffsetY?: number;
  nameFontSize?: number;
  beltFontSize?: number;
  hideBorder?: boolean;
  hideHeader?: boolean;
  hideSeal?: boolean;
  hideBadgeBox?: boolean;
}

/**
 * Sanitizes input strings so they strictly conform to standard PDF WinAnsi / Latin-1 encoding.
 */
export function cleanPdfText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[•●]/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/[★☆✦]/g, '*')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
    .trim();
}

/**
 * Generates official Martial Arts Promotion Certificate PDF according to user specifications:
 * - Keeps ONLY: Student Name (in Old English font), Single Passed Belt, Player Reg No, Date of Birth, Actual Examination Date, Serial Number.
 * - Strips: Level, From/To rank, discipline, Certificate of Rank Promotion, This is to certify, signatures, lines/commendations below name, and "Certificate Serial" label.
 * - Supports customizable field positioning and Dojo/location changes.
 */
export async function generateMartialArtsCertificatePdf(cert: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // A4 Landscape dimensions in PDF points (72 points per inch)
  const width = 841.89;
  const height = 595.28;
  const page = doc.addPage([width, height]);

  // Embed standard fallback fonts
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontTimesBold = await doc.embedFont(StandardFonts.TimesRomanBold);

  // Attempt to load and embed Old English Text font for the student name
  let fontOldEnglish: any = null;
  try {
    const fontUrl = '/fonts/OldEnglish.ttf';
    const response = await fetch(fontUrl);
    if (response.ok) {
      const fontBytes = await response.arrayBuffer();
      fontOldEnglish = await doc.embedFont(fontBytes);
    }
  } catch (e) {
    console.warn('[PDF] Could not load OldEnglish font via fetch, using TimesRomanBold fallback:', e);
  }

  const nameFont = fontOldEnglish || fontTimesBold;

  // Normalize data fields
  const studentFirstName = cleanPdfText(cert.student_name || cert.playerName || 'Student Athlete');
  const fatherName = cleanPdfText(cert.fatherName || cert.parentName || cert.father_name || cert.parent_name || '');

  // Format student name: First [Father] Surname
  const studentParts = studentFirstName.trim().split(/\s+/);
  const studentFirst = studentParts[0] || '';
  const studentSurname = studentParts.length > 1 ? studentParts[studentParts.length - 1] : '';

  const fatherParts = fatherName.trim().split(/\s+/);
  const fatherFirst = fatherParts[0] || '';

  let formattedStudentName: string;
  if (fatherFirst) {
    if (studentSurname && studentSurname !== studentFirst) {
      formattedStudentName = `${studentFirst} ${fatherFirst} ${studentSurname}`;
    } else {
      formattedStudentName = `${studentFirst} ${fatherFirst}`;
    }
  } else {
    formattedStudentName = studentFirstName;
  }

  const regNo = cleanPdfText(cert.student_code || cert.regNumber || 'ATH-2026');
  
  // Single passed belt only (e.g. "YELLOW BELT")
  const rawBelt = cleanPdfText(cert.belt_color || cert.beltColor || cert.to_rank_name || cert.rankSecured || 'Yellow');
  const beltClean = rawBelt.replace(/belt/gi, '').trim();
  const passedBelt = `${beltClean.toUpperCase()} BELT`;

  // Actual Examination Date (strictly the recorded exam date)
  const rawDate = cert.promoted_at || cert.promotionDate;
  let formattedExamDate = 'Current Session';
  if (rawDate && !isNaN(new Date(rawDate).getTime())) {
    formattedExamDate = new Date(rawDate).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  let formattedDob = 'On File';
  if (cert.dob && !isNaN(new Date(cert.dob).getTime())) {
    formattedDob = new Date(cert.dob).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  const certNumber = cleanPdfText(cert.certificate_number || cert.certificateNumber || `CERT-${Math.floor(100000 + Math.random() * 900000)}`);
  const dojo = cleanPdfText(cert.dojoLocation || cert.represented_from || cert.representedFrom || 'Central Dojo');

  // Print mode and calibrations
  const isPlainPaper = cert.printMode === 'PLAIN_PAPER';
  const hideBorder = cert.hideBorder ?? isPlainPaper;
  const hideHeader = cert.hideHeader ?? isPlainPaper;
  const hideSeal = cert.hideSeal ?? isPlainPaper;
  const hideBackground = isPlainPaper;
  const hideBadgeBox = cert.hideBadgeBox ?? isPlainPaper;

  // 1 mm = 2.83465 PDF points
  const dx = (cert.offsetX || 0) * 2.83465;
  const dy = (cert.offsetY || 0) * 2.83465;

  const nameDx = (cert.nameOffsetX || 0) * 2.83465 + dx;
  const nameDy = (cert.nameOffsetY || 0) * 2.83465 + dy;

  const beltDx = (cert.beltOffsetX || 0) * 2.83465 + dx;
  const beltDy = (cert.beltOffsetY || 0) * 2.83465 + dy;

  const metaDx = (cert.metaOffsetX || 0) * 2.83465 + dx;
  const metaDy = (cert.metaOffsetY || 0) * 2.83465 + dy;

  // 1. Background Fill (Delicate Parchment Cream)
  if (!hideBackground) {
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height,
      color: rgb(0.996, 0.992, 0.976),
    });
  }

  // 2. Multi-tier Borders & Corner Flourishes
  if (!hideBorder) {
    page.drawRectangle({
      x: 18,
      y: 18,
      width: width - 36,
      height: height - 36,
      borderWidth: 4,
      borderColor: rgb(15 / 255, 23 / 255, 42 / 255),
    });

    page.drawRectangle({
      x: 26,
      y: 26,
      width: width - 52,
      height: height - 52,
      borderWidth: 1.8,
      borderColor: rgb(217 / 255, 119 / 255, 6 / 255),
    });

    page.drawRectangle({
      x: 31,
      y: 31,
      width: width - 62,
      height: height - 62,
      borderWidth: 0.6,
      borderColor: rgb(245 / 255, 158 / 255, 11 / 255),
    });

    const drawCornerFlourish = (cx: number, cy: number) => {
      page.drawRectangle({
        x: cx - 4,
        y: cy - 4,
        width: 8,
        height: 8,
        color: rgb(217 / 255, 119 / 255, 6 / 255),
      });
      page.drawCircle({
        x: cx,
        y: cy,
        size: 7,
        borderWidth: 1,
        borderColor: rgb(15 / 255, 23 / 255, 42 / 255),
      });
    };
    drawCornerFlourish(26, 26);
    drawCornerFlourish(width - 26, 26);
    drawCornerFlourish(26, height - 26);
    drawCornerFlourish(width - 26, height - 26);
  }

  const drawCenteredText = (text: string, y: number, size: number, font: any, color: any, offsetX = dx) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (width - textWidth) / 2 + offsetX,
      y,
      size,
      font,
      color,
    });
  };

  // 3. Header: Academy Name & Dojo / Location
  let currentY = height - 66 + dy;
  if (!hideHeader) {
    drawCenteredText('GURUKUL SPORTS & MARTIAL ARTS ACADEMY', currentY, 22, fontBold, rgb(10 / 255, 17 / 255, 32 / 255));
    
    currentY -= 16;
    drawCenteredText(`${dojo.toUpperCase()} - COUNCIL OF MARTIAL ARTS`, currentY, 9, fontBold, rgb(180 / 255, 83 / 255, 9 / 255));

    // Golden Divider Line
    currentY -= 16;
    const dividerHalfWidth = 260;
    const centerX = width / 2 + dx;
    page.drawLine({
      start: { x: centerX - dividerHalfWidth, y: currentY },
      end: { x: centerX - 12, y: currentY },
      thickness: 1.2,
      color: rgb(217 / 255, 119 / 255, 6 / 255),
    });
    page.drawLine({
      start: { x: centerX + 12, y: currentY },
      end: { x: centerX + dividerHalfWidth, y: currentY },
      thickness: 1.2,
      color: rgb(217 / 255, 119 / 255, 6 / 255),
    });
    page.drawRectangle({
      x: centerX - 4,
      y: currentY - 4,
      width: 8,
      height: 8,
      color: rgb(217 / 255, 119 / 255, 6 / 255),
    });
  } else {
    currentY -= 60;
  }

  // 4. Student Name in OLD ENGLISH FONT (No underline, no extra commendation text)
  currentY -= 70;
  let customNameSize = cert.nameFontSize || 38;
  const nameDisplay = formattedStudentName;

  while (nameFont.widthOfTextAtSize(nameDisplay, customNameSize) > 640 && customNameSize > 20) {
    customNameSize -= 1;
  }

  const nameTextWidth = nameFont.widthOfTextAtSize(nameDisplay, customNameSize);
  const finalNameX = (width - nameTextWidth) / 2 + nameDx;
  const finalNameY = currentY + nameDy;

  page.drawText(nameDisplay, {
    x: finalNameX,
    y: finalNameY,
    size: customNameSize,
    font: nameFont,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });

  // 5. Single Passed Belt (No "Level", no "From/To rank", no "Discipline")
  currentY -= 72;
  const badgeWidth = 380;
  const badgeHeight = 46;
  const badgeX = (width - badgeWidth) / 2 + beltDx;
  const badgeY = currentY + beltDy;

  if (!hideBadgeBox) {
    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeWidth,
      height: badgeHeight,
      color: rgb(254 / 255, 243 / 255, 199 / 255),
      borderWidth: 1.5,
      borderColor: rgb(217 / 255, 119 / 255, 6 / 255),
    });
  }

  const beltSize = cert.beltFontSize || 17;
  const beltTextWidth = fontBold.widthOfTextAtSize(passedBelt, beltSize);
  page.drawText(passedBelt, {
    x: (width - beltTextWidth) / 2 + beltDx,
    y: badgeY + (badgeHeight - beltSize) / 2 + 1,
    size: beltSize,
    font: fontBold,
    color: rgb(180 / 255, 83 / 255, 9 / 255),
  });

  // 6. Metadata Cards (4 Columns: Reg No, DOB, Actual Exam Date, Serial Number without label)
  currentY -= 70;
  const colY = currentY + metaDy;
  const metadata = [
    { label: 'PLAYER REG NO', value: regNo },
    { label: 'DATE OF BIRTH', value: formattedDob },
    { label: 'ACTUAL EXAM DATE', value: formattedExamDate },
    { label: '', value: certNumber, isSerialOnly: true }, // "Certificate Serial हा label काढा"
  ];

  const totalCardWidth = width - 140;
  const cardWidth = totalCardWidth / 4;
  const startX = 70;

  metadata.forEach((m, idx) => {
    const boxX = startX + idx * cardWidth + metaDx;
    if (!isPlainPaper) {
      page.drawRectangle({
        x: boxX + 4,
        y: colY - 14,
        width: cardWidth - 8,
        height: 34,
        color: rgb(248 / 255, 250 / 255, 252 / 255),
        borderWidth: 0.75,
        borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
      });
    }

    if (m.label) {
      const lblWidth = fontBold.widthOfTextAtSize(m.label, 7.5);
      page.drawText(m.label, {
        x: boxX + 4 + (cardWidth - 8 - lblWidth) / 2,
        y: colY + 6,
        size: 7.5,
        font: fontBold,
        color: rgb(100 / 255, 116 / 255, 139 / 255),
      });
    }

    const valFontSize = m.isSerialOnly ? 10.5 : 9.5;
    const valWidth = fontBold.widthOfTextAtSize(m.value, valFontSize);
    const valY = m.label ? colY - 7 : colY - 2; // Centered if no label
    page.drawText(m.value, {
      x: boxX + 4 + (cardWidth - 8 - valWidth) / 2,
      y: valY,
      size: valFontSize,
      font: fontBold,
      color: m.isSerialOnly ? rgb(180 / 255, 83 / 255, 9 / 255) : rgb(15 / 255, 23 / 255, 42 / 255),
    });
  });

  // 7. Golden Seal Medallion (Center bottom) - Signatures REMOVED
  const footerY = 54 + dy;
  const sealCenterX = width / 2 + dx;
  const sealCenterY = footerY + 16;
  if (!hideSeal) {
    page.drawCircle({
      x: sealCenterX,
      y: sealCenterY,
      size: 24,
      color: rgb(254 / 255, 243 / 255, 199 / 255),
      borderWidth: 2,
      borderColor: rgb(217 / 255, 119 / 255, 6 / 255),
    });
    page.drawCircle({
      x: sealCenterX,
      y: sealCenterY,
      size: 20,
      borderWidth: 0.8,
      borderColor: rgb(245 / 255, 158 / 255, 11 / 255),
    });

    const sealTitle = 'OFFICIAL SEAL';
    const sealTWidth = fontBold.widthOfTextAtSize(sealTitle, 6);
    page.drawText(sealTitle, {
      x: sealCenterX - sealTWidth / 2,
      y: sealCenterY + 4,
      size: 6,
      font: fontBold,
      color: rgb(180 / 255, 83 / 255, 9 / 255),
    });

    const sealSub = 'GURUKUL ACADEMY';
    const sealSWidth = fontBold.widthOfTextAtSize(sealSub, 5);
    page.drawText(sealSub, {
      x: sealCenterX - sealSWidth / 2,
      y: sealCenterY - 3,
      size: 5,
      font: fontBold,
      color: rgb(15 / 255, 23 / 255, 42 / 255),
    });

    const sealAccred = 'HONOR & MASTERY';
    const sealAWidth = fontBold.widthOfTextAtSize(sealAccred, 5);
    page.drawText(sealAccred, {
      x: sealCenterX - sealAWidth / 2,
      y: sealCenterY - 9,
      size: 5,
      font: fontBold,
      color: rgb(217 / 255, 119 / 255, 6 / 255),
    });
  }

  return await doc.save();
}

/**
 * Triggers a direct browser file download for the generated certificate PDF
 */
export async function downloadCertificatePdf(cert: CertificateData): Promise<void> {
  const pdfBytes = await generateMartialArtsCertificatePdf(cert);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const studentSafe = (cert.student_name || cert.playerName || 'Student')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 30);
  const beltSafe = (cert.belt_color || cert.beltColor || 'Belt')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 20);
  const fileName = `Gurukul_Certificate_${studentSafe}_${beltSafe}.pdf`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Opens a print dialog in browser with the certificate PDF loaded in an invisible iframe
 */
export async function printCertificatePdf(cert: CertificateData): Promise<void> {
  const pdfBytes = await generateMartialArtsCertificatePdf(cert);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank');
    }
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
      URL.revokeObjectURL(url);
    }, 60000);
  };
}
