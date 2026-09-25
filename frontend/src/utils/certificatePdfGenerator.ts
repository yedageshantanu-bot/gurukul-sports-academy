import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface CertificateData {
  id?: string;
  student_name?: string;
  playerName?: string;
  student_code?: string;
  regNumber?: string;
  dob?: string;
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
}

/**
 * Generates an official, publication-grade A4 Landscape Martial Arts Promotion Certificate PDF
 * using pure vector graphics, ornate multi-tier borders, gold seals, and typography.
 */
export async function generateMartialArtsCertificatePdf(cert: CertificateData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  // A4 Landscape dimensions in PDF points (72 points per inch)
  const width = 841.89;
  const height = 595.28;
  const page = doc.addPage([width, height]);

  // Embed core PDF fonts
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);

  // Normalize data fields with safe fallbacks
  const studentName = (cert.student_name || cert.playerName || 'Athletic Trainee').trim();
  const regNo = cert.student_code || cert.regNumber || 'GSA-ATH-2026';
  const discipline = cert.discipline_name || cert.disciplineName || 'Martial Arts & Combat Sports';
  const rankName = cert.to_rank_name || cert.rankSecured || 'Advanced Grade';
  const beltColor = cert.belt_color || cert.beltColor || 'Yellow';
  
  // Format dates safely
  const rawDate = cert.promoted_at || cert.promotionDate;
  let formattedExamDate = 'Current Session 2026';
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

  const certNumber = cert.certificate_number || cert.certificateNumber || `GSA-CERT-${Math.floor(100000 + Math.random() * 900000)}`;
  const examiner = cert.examiner_name || cert.promotedBy || 'Chief Master & Technical Director';
  const dojo = cert.represented_from || cert.representedFrom || 'Gurukul Sports Academy Central Dojo';

  // 1. Background Fill (Delicate Parchment Cream)
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.996, 0.992, 0.976),
  });

  // 2. Layer 1: Outermost Deep Navy Border
  page.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    borderWidth: 4,
    borderColor: rgb(15 / 255, 23 / 255, 42 / 255), // Navy #0F172A
  });

  // 3. Layer 2: Ornate Antique Gold Border with Corner Insets
  page.drawRectangle({
    x: 26,
    y: 26,
    width: width - 52,
    height: height - 52,
    borderWidth: 1.8,
    borderColor: rgb(217 / 255, 119 / 255, 6 / 255), // Rich Amber Gold #D97706
  });

  // 4. Layer 3: Hairline Interior Gold Accent Border
  page.drawRectangle({
    x: 31,
    y: 31,
    width: width - 62,
    height: height - 62,
    borderWidth: 0.6,
    borderColor: rgb(245 / 255, 158 / 255, 11 / 255), // Light Gold #F59E0B
  });

  // 5. Corner Corner Flourish Squares & Diamonds
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

  // Helper to center text horizontally
  const drawCenteredText = (text: string, y: number, size: number, font: any, color: any) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: (width - textWidth) / 2,
      y,
      size,
      font,
      color,
    });
  };

  // 6. Header: Academy Name & Affiliation
  let currentY = height - 64;
  drawCenteredText('GURUKUL SPORTS & MARTIAL ARTS ACADEMY', currentY, 21, fontBold, rgb(10 / 255, 17 / 255, 32 / 255));
  
  currentY -= 14;
  drawCenteredText('CENTRAL DOJO • COUNCIL OF TRADITIONAL KALARIPPAYATTU & COMBAT SPORTS', currentY, 8.5, fontBold, rgb(180 / 255, 83 / 255, 9 / 255));

  // Decorative Golden Divider Line with Center Diamond
  currentY -= 14;
  const dividerHalfWidth = 260;
  const centerX = width / 2;
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
  // Center Diamond
  page.drawRectangle({
    x: centerX - 4,
    y: currentY - 4,
    width: 8,
    height: 8,
    color: rgb(217 / 255, 119 / 255, 6 / 255),
  });

  // 7. Certificate Title
  currentY -= 26;
  drawCenteredText('CERTIFICATE OF RANK PROMOTION', currentY, 17, fontBold, rgb(180 / 255, 83 / 255, 9 / 255));

  // 8. "This is proudly presented to"
  currentY -= 18;
  drawCenteredText('This is to certify that athlete / martial artist', currentY, 11, fontItalic, rgb(71 / 255, 85 / 255, 105 / 255));

  // 9. Student Name in Majestic Headline Typography
  currentY -= 32;
  const displayStudentName = studentName.toUpperCase();
  drawCenteredText(displayStudentName, currentY, 24, fontBold, rgb(10 / 255, 17 / 255, 32 / 255));

  // Double underline under student name
  const nameWidth = fontBold.widthOfTextAtSize(displayStudentName, 24);
  const nameUnderlineStart = (width - nameWidth) / 2 - 10;
  const nameUnderlineWidth = nameWidth + 20;
  page.drawLine({
    start: { x: nameUnderlineStart, y: currentY - 4 },
    end: { x: nameUnderlineStart + nameUnderlineWidth, y: currentY - 4 },
    thickness: 1.2,
    color: rgb(217 / 255, 119 / 255, 6 / 255),
  });
  page.drawLine({
    start: { x: nameUnderlineStart + 20, y: currentY - 7 },
    end: { x: nameUnderlineStart + nameUnderlineWidth - 20, y: currentY - 7 },
    thickness: 0.6,
    color: rgb(245 / 255, 158 / 255, 11 / 255),
  });

  // 10. Commendation / Syllabus Text
  currentY -= 24;
  const commendationP1 = 'has demonstrated exemplary technical proficiency, combat readiness, syllabus mastery,';
  const commendationP2 = 'and honorable athletic sportsmanship, and is hereby promoted to the prestigious rank of';
  drawCenteredText(commendationP1, currentY, 10, fontRegular, rgb(51 / 255, 65 / 255, 85 / 255));
  currentY -= 13;
  drawCenteredText(commendationP2, currentY, 10, fontRegular, rgb(51 / 255, 65 / 255, 85 / 255));

  // 11. Prominent Rank & Belt Highlight Badge
  currentY -= 48;
  const badgeWidth = 440;
  const badgeHeight = 44;
  const badgeX = (width - badgeWidth) / 2;
  const badgeY = currentY;

  // Badge background with soft warm amber tint
  page.drawRectangle({
    x: badgeX,
    y: badgeY,
    width: badgeWidth,
    height: badgeHeight,
    color: rgb(254 / 255, 243 / 255, 199 / 255), // Amber 100
    borderWidth: 1.5,
    borderColor: rgb(217 / 255, 119 / 255, 6 / 255), // Amber 600
  });

  // Badge Text: Rank Name + Belt Color
  const rankText = `${rankName.toUpperCase()} — ${beltColor.toUpperCase()} BELT`;
  const discText = `Discipline: ${discipline}`;
  const rankTextWidth = fontBold.widthOfTextAtSize(rankText, 14);
  page.drawText(rankText, {
    x: (width - rankTextWidth) / 2,
    y: badgeY + 24,
    size: 14,
    font: fontBold,
    color: rgb(180 / 255, 83 / 255, 9 / 255),
  });

  const discTextWidth = fontBold.widthOfTextAtSize(discText, 9.5);
  page.drawText(discText, {
    x: (width - discTextWidth) / 2,
    y: badgeY + 10,
    size: 9.5,
    font: fontBold,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });

  // 12. Official Metadata Cards (4 Columns)
  currentY -= 36;
  const colY = currentY;
  const metadata = [
    { label: 'PLAYER REG NO', value: regNo },
    { label: 'DATE OF BIRTH', value: formattedDob },
    { label: 'EXAMINATION DATE', value: formattedExamDate },
    { label: 'CERTIFICATE SERIAL', value: certNumber },
  ];

  const totalCardWidth = width - 120;
  const cardWidth = totalCardWidth / 4;
  const startX = 60;

  metadata.forEach((m, idx) => {
    const boxX = startX + idx * cardWidth;
    page.drawRectangle({
      x: boxX + 4,
      y: colY - 14,
      width: cardWidth - 8,
      height: 32,
      color: rgb(248 / 255, 250 / 255, 252 / 255),
      borderWidth: 0.75,
      borderColor: rgb(203 / 255, 213 / 255, 225 / 255),
    });

    const lblWidth = fontBold.widthOfTextAtSize(m.label, 7.5);
    page.drawText(m.label, {
      x: boxX + 4 + (cardWidth - 8 - lblWidth) / 2,
      y: colY + 5,
      size: 7.5,
      font: fontBold,
      color: rgb(100 / 255, 116 / 255, 139 / 255),
    });

    const valWidth = fontBold.widthOfTextAtSize(m.value, 9.5);
    page.drawText(m.value, {
      x: boxX + 4 + (cardWidth - 8 - valWidth) / 2,
      y: colY - 7,
      size: 9.5,
      font: fontBold,
      color: rgb(15 / 255, 23 / 255, 42 / 255),
    });
  });

  // 13. Signatures & Official Gold Seal Section
  const footerY = 62;

  // Left Signature: Chief Examiner
  const leftSigX = 80;
  page.drawLine({
    start: { x: leftSigX, y: footerY + 22 },
    end: { x: leftSigX + 180, y: footerY + 22 },
    thickness: 1,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });
  page.drawText(examiner, {
    x: leftSigX,
    y: footerY + 10,
    size: 9,
    font: fontBold,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });
  page.drawText('Chief Examiner & Grading Master', {
    x: leftSigX,
    y: footerY,
    size: 7.5,
    font: fontRegular,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });

  // Center: Official Golden Seal Medallion (Drawn with vectors)
  const sealCenterX = width / 2;
  const sealCenterY = footerY + 16;
  page.drawCircle({
    x: sealCenterX,
    y: sealCenterY,
    size: 26,
    color: rgb(254 / 255, 243 / 255, 199 / 255),
    borderWidth: 2,
    borderColor: rgb(217 / 255, 119 / 255, 6 / 255),
  });
  page.drawCircle({
    x: sealCenterX,
    y: sealCenterY,
    size: 22,
    borderWidth: 0.8,
    borderColor: rgb(245 / 255, 158 / 255, 11 / 255),
  });

  const sealTitle = 'OFFICIAL SEAL';
  const sealTWidth = fontBold.widthOfTextAtSize(sealTitle, 6.5);
  page.drawText(sealTitle, {
    x: sealCenterX - sealTWidth / 2,
    y: sealCenterY + 4,
    size: 6.5,
    font: fontBold,
    color: rgb(180 / 255, 83 / 255, 9 / 255),
  });

  const sealSub = 'GURUKUL ACADEMY';
  const sealSWidth = fontBold.widthOfTextAtSize(sealSub, 5.5);
  page.drawText(sealSub, {
    x: sealCenterX - sealSWidth / 2,
    y: sealCenterY - 4,
    size: 5.5,
    font: fontBold,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });

  const starText = '★ ★ ★';
  const starWidth = fontBold.widthOfTextAtSize(starText, 6);
  page.drawText(starText, {
    x: sealCenterX - starWidth / 2,
    y: sealCenterY - 11,
    size: 6,
    font: fontBold,
    color: rgb(217 / 255, 119 / 255, 6 / 255),
  });

  // Right Signature: Academy Director
  const rightSigX = width - 260;
  page.drawLine({
    start: { x: rightSigX, y: footerY + 22 },
    end: { x: rightSigX + 180, y: footerY + 22 },
    thickness: 1,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });
  page.drawText('Academy Director & Head Coach', {
    x: rightSigX,
    y: footerY + 10,
    size: 9,
    font: fontBold,
    color: rgb(15 / 255, 23 / 255, 42 / 255),
  });
  page.drawText(dojo, {
    x: rightSigX,
    y: footerY,
    size: 7.5,
    font: fontRegular,
    color: rgb(100 / 255, 116 / 255, 139 / 255),
  });

  // Bottom Security Line
  const securityNotice = `Authentic Gurukul Credential • Verified by Registry Engine • Document ID: ${certNumber}`;
  const secWidth = fontRegular.widthOfTextAtSize(securityNotice, 7);
  page.drawText(securityNotice, {
    x: (width - secWidth) / 2,
    y: 35,
    size: 7,
    font: fontRegular,
    color: rgb(148 / 255, 163 / 255, 184 / 255),
  });

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
  const rankSafe = (cert.to_rank_name || cert.rankSecured || 'Rank')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 20);
  const fileName = `Gurukul_Certificate_${studentSafe}_${rankSafe}.pdf`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
