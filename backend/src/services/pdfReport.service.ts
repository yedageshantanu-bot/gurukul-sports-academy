import PDFDocument from 'pdfkit';

export interface StudentReportData {
  studentName: string;
  parentName?: string;
  course?: string;
  studentMobile?: string;
  parentWhatsapp?: string;
  admissionDate?: string;
  batches: Array<{
    name: string;
    subject?: string;
    scheduleDays?: string[];
    startTime?: string;
    endTime?: string;
  }>;
  attendance: {
    totalSessions: number;
    presentCount: number;
    absentCount: number;
    attendanceRate: number;
  };
  fees: {
    monthlyFee: number;
    feeDueDay: number;
    currentMonthStatus: string;
    pendingAmount: number;
    billingPeriod: string;
    upiId?: string;
    upiPayeeName?: string;
  };
  martialArtsRank?: {
    disciplineName: string;
    currentRankName: string;
    beltColor: string;
    regNumber?: string;
    promotedAt?: string;
    examinerName?: string;
    certificateNumber?: string;
    previousRankName?: string;
    examResult?: string;
  };
  tournamentHighlights?: Array<{
    tournamentName: string;
    discipline?: string;
    date?: string;
    achievement?: string;
  }>;
  academyName?: string;
  logoUrl?: string;
}

export class PdfReportService {
  /**
   * Generates a modern, agency-grade branded A4 PDF document buffer for student monthly progress,
   * attendance, belt examination rank result, and fee statement.
   */
  static async generateStudentMonthlyReportPdf(data: StudentReportData): Promise<Buffer> {
    let imgBuffer: Buffer | null = null;
    if (data.logoUrl) {
      try {
        if (data.logoUrl.startsWith('data:image/')) {
          const base64Data = data.logoUrl.split(';base64,').pop();
          if (base64Data) {
            imgBuffer = Buffer.from(base64Data, 'base64');
          }
        } else if (data.logoUrl.startsWith('http://') || data.logoUrl.startsWith('https://')) {
          const resp = await fetch(data.logoUrl);
          if (resp.ok) {
            const arrBuf = await resp.arrayBuffer();
            imgBuffer = Buffer.from(arrBuf);
          }
        }
      } catch (err) {
        console.warn('PDF logo load fallback error:', err);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 36,
          info: {
            Title: `${data.studentName} — Official Monthly Report`,
            Author: data.academyName || 'Gurukul Sports & Martial Arts Academy',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const academyName = data.academyName || 'GURUKUL SPORTS & MARTIAL ARTS ACADEMY';
        
        // Premium Academy Color Palette
        const primaryDark = '#090D1A'; // Deep obsidian navy
        const secondaryDark = '#1E293B'; // Slate 800
        const accentGold = '#D97706'; // Martial Arts Gold
        const lightGold = '#FEF3C7'; // Pale amber
        const textGold = '#B45309'; // Rich gold text
        const accentIndigo = '#4F46E5'; // Indigo
        const lightIndigo = '#EEF2FF';
        const emeraldGreen = '#059669'; // Emerald
        const lightEmerald = '#ECFDF5';
        const borderEmerald = '#A7F3D0';
        const textDark = '#0F172A'; // Slate 900
        const textMuted = '#64748B'; // Slate 500
        const lightBg = '#F8FAFC'; // Slate 50
        const borderLight = '#E2E8F0'; // Slate 200

        const pageWidth = doc.page.width;
        const contentWidth = 523; // 595.28 - 72

        // =========================================================================
        // 1. TOP HEADER BANNER (Obsidian with Dual Emerald & Gold Pin-Stripes)
        // =========================================================================
        const headerHeight = 94;
        doc.rect(0, 0, pageWidth, headerHeight).fill(primaryDark);
        // Dual accent accent pinstripes
        doc.rect(0, headerHeight - 4, pageWidth, 2.5).fill(emeraldGreen);
        doc.rect(0, headerHeight - 1.5, pageWidth, 1.5).fill(accentGold);

        let textStartX = 36;
        if (imgBuffer) {
          try {
            doc.roundedRect(36, 16, 62, 62, 8).fill('#FFFFFF');
            doc.image(imgBuffer, 41, 21, { fit: [52, 52], align: 'center', valign: 'center' });
            textStartX = 112;
          } catch (e) {
            textStartX = 36;
          }
        }

        // Academy Title
        doc
          .fillColor('#FFFFFF')
          .fontSize(15)
          .font('Helvetica-Bold')
          .text(academyName.toUpperCase(), textStartX, 22, { width: 520 - textStartX });

        // Subtitle / Report Type
        doc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#FDE68A') // Pale gold
          .text(`MONTHLY ATHLETE PROGRESS & EXAMINATION REPORT — ${data.fees.billingPeriod.toUpperCase()}`, textStartX, 44, {
            width: 520 - textStartX,
          });

        // Certification tagline
        doc
          .fontSize(7.5)
          .font('Helvetica')
          .fillColor('#94A3B8')
          .text(`Affiliated Martial Arts & Sports Development Center • Verified Computer Dossier • Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, textStartX, 62);

        // Status pill on right of header
        doc.roundedRect(440, 20, 119, 24, 6).fill('#1E293B');
        doc.fillColor('#34D399').font('Helvetica-Bold').fontSize(7.5).text('OFFICIAL RECORD', 440, 25, { width: 119, align: 'center' });
        doc.fontSize(6.5).font('Helvetica').fillColor('#94A3B8').text('ISO / FEDERATION COMPLIANT', 440, 34, { width: 119, align: 'center' });

        let currentY = 108;

        // =========================================================================
        // 2. ATHLETE & GUARDIAN PROFILE DOSSIER
        // =========================================================================
        const cardHeight = 78;
        doc
          .roundedRect(36, currentY, contentWidth, cardHeight, 8)
          .fillAndStroke(lightBg, borderLight);

        doc
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .fillColor(accentIndigo)
          .text('ATHLETE DOSSIER & REGISTRATION', 48, currentY + 10);

        // Full Student Name
        doc.fillColor(textDark).font('Helvetica-Bold').fontSize(13);
        doc.text(data.studentName, 48, currentY + 24);

        // Left col details
        doc.font('Helvetica').fontSize(8.5).fillColor(textMuted);
        doc.text('Course / Discipline: ', 48, currentY + 44, { continued: true });
        doc.font('Helvetica-Bold').fillColor(textDark).text(data.course || 'Martial Arts & Athletics');

        doc.font('Helvetica').fontSize(8.5).fillColor(textMuted);
        doc.text('Parent / Guardian: ', 48, currentY + 58, { continued: true });
        doc.font('Helvetica-Bold').fillColor(textDark).text(data.parentName || 'Registered Guardian');

        // Right col details
        const rightColX = 310;
        doc.font('Helvetica').fontSize(8.5).fillColor(textMuted);
        doc.text('Parent WhatsApp: ', rightColX, currentY + 28, { continued: true });
        doc.font('Helvetica-Bold').fillColor(emeraldGreen).text(data.parentWhatsapp || 'Registered');

        doc.font('Helvetica').fontSize(8.5).fillColor(textMuted);
        doc.text('Athlete Contact: ', rightColX, currentY + 44, { continued: true });
        doc.font('Helvetica-Bold').fillColor(textDark).text(data.studentMobile || 'On File');

        doc.font('Helvetica').fontSize(8.5).fillColor(textMuted);
        doc.text('Admission Date: ', rightColX, currentY + 58, { continued: true });
        doc.font('Helvetica-Bold').fillColor(textDark).text(data.admissionDate || 'Enrolled Active');

        currentY += cardHeight + 14;

        // =========================================================================
        // 3. MARTIAL ARTS BELT & EXAMINATION RESULT (Requested by User)
        // =========================================================================
        if (data.martialArtsRank) {
          const rank = data.martialArtsRank;
          const beltCardHeight = 84;
          
          // Belt background styling helper
          const beltColorLower = (rank.beltColor || '').toLowerCase();
          let beltBadgeBg = '#FEF3C7';
          let beltBadgeText = '#92400E';
          let beltBorder = '#FCD34D';

          if (beltColorLower.includes('yellow')) {
            beltBadgeBg = '#FEF08A';
            beltBadgeText = '#854D0E';
            beltBorder = '#EAB308';
          } else if (beltColorLower.includes('orange')) {
            beltBadgeBg = '#FFEDD5';
            beltBadgeText = '#9A3412';
            beltBorder = '#F97316';
          } else if (beltColorLower.includes('green')) {
            beltBadgeBg = '#DCFCE7';
            beltBadgeText = '#166534';
            beltBorder = '#22C55E';
          } else if (beltColorLower.includes('blue')) {
            beltBadgeBg = '#E0F2FE';
            beltBadgeText = '#075985';
            beltBorder = '#0EA5E9';
          } else if (beltColorLower.includes('purple')) {
            beltBadgeBg = '#F3E8FF';
            beltBadgeText = '#6B21A8';
            beltBorder = '#A855F7';
          } else if (beltColorLower.includes('brown')) {
            beltBadgeBg = '#EFEAE6';
            beltBadgeText = '#57371D';
            beltBorder = '#8D5B32';
          } else if (beltColorLower.includes('black')) {
            beltBadgeBg = '#0F172A';
            beltBadgeText = '#FFFFFF';
            beltBorder = '#334155';
          } else if (beltColorLower.includes('red')) {
            beltBadgeBg = '#FFE4E6';
            beltBadgeText = '#9F1239';
            beltBorder = '#F43F5E';
          }

          doc
            .roundedRect(36, currentY, contentWidth, beltCardHeight, 8)
            .fillAndStroke('#FFFDF5', '#FDE68A');

          // Header
          doc
            .fontSize(8.5)
            .font('Helvetica-Bold')
            .fillColor(accentGold)
            .text('🥋 MARTIAL ARTS EXAMINATION & BELT GRADING RESULT', 48, currentY + 10);

          // Belt Rank Name
          doc.fillColor('#78350F').font('Helvetica-Bold').fontSize(13);
          doc.text(rank.currentRankName, 48, currentY + 25);

          // Details line 1
          doc.font('Helvetica').fontSize(8.5).fillColor('#92400E');
          doc.text('Discipline: ', 48, currentY + 44, { continued: true });
          doc.font('Helvetica-Bold').fillColor('#78350F').text(rank.disciplineName, { continued: true });
          doc.font('Helvetica').fillColor('#92400E').text('   |   Reg No: ', { continued: true });
          doc.font('Helvetica-Bold').fillColor(accentGold).text(rank.regNumber || 'GSA-ATHLETE');

          // Details line 2
          const promDate = rank.promotedAt
            ? new Date(rank.promotedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'Active Grade';
          doc.font('Helvetica').fontSize(8).fillColor('#B45309');
          doc.text(`Promotion Date: ${promDate}   •   Examiner: ${rank.examinerName || 'Sensei / Chief Master'}`, 48, currentY + 58);
          
          if (rank.certificateNumber) {
            doc.text(`Certificate #: ${rank.certificateNumber}   •   Status: PASSED & FEDERATION RATIFIED`, 48, currentY + 70);
          }

          // Visual Belt Badge Pill on right
          const pillX = 390;
          doc.roundedRect(pillX, currentY + 18, 155, 34, 6).fillAndStroke(beltBadgeBg, beltBorder);
          doc.fillColor(beltBadgeText).font('Helvetica-Bold').fontSize(10).text(`${rank.beltColor.toUpperCase()} BELT`, pillX, currentY + 24, { width: 155, align: 'center' });
          doc.fontSize(7).font('Helvetica').fillColor(beltBadgeText).text('OFFICIALLY CERTIFIED GRADE', pillX, currentY + 37, { width: 155, align: 'center' });

          currentY += beltCardHeight + 14;
        }

        // =========================================================================
        // 4. ATTENDANCE & PERFORMANCE SUMMARY (3 Balanced KPI Blocks)
        // =========================================================================
        doc
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .fillColor(primaryDark)
          .text('MONTHLY ATTENDANCE & DISCIPLINE METRICS', 36, currentY);

        currentY += 15;
        const kpiWidth = 166;
        const kpiGap = 12;

        // KPI 1: Attendance Rate
        doc.roundedRect(36, currentY, kpiWidth, 60, 6).fillAndStroke(lightEmerald, borderEmerald);
        doc.fillColor('#166534').font('Helvetica-Bold').fontSize(8).text('ATTENDANCE PERCENTAGE', 46, currentY + 10);
        doc.fillColor('#15803D').fontSize(17).font('Helvetica-Bold').text(`${data.attendance.attendanceRate}%`, 46, currentY + 23);
        const ratingText = data.attendance.attendanceRate >= 85
          ? '⭐ Exceptional Dedication'
          : data.attendance.attendanceRate >= 70
          ? '✓ Consistent Participation'
          : '⚠️ Regular Attendance Recommended';
        doc.fontSize(7.5).font('Helvetica').fillColor('#166534').text(ratingText, 46, currentY + 44);

        // KPI 2: Sessions Attended
        const kpi2X = 36 + kpiWidth + kpiGap;
        doc.roundedRect(kpi2X, currentY, kpiWidth, 60, 6).fillAndStroke('#EFF6FF', '#BFDBFE');
        doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(8).text('CLASSES ATTENDED', kpi2X + 10, currentY + 10);
        doc.fillColor('#1D4ED8').fontSize(17).font('Helvetica-Bold').text(`${data.attendance.presentCount} Sessions`, kpi2X + 10, currentY + 23);
        doc.fontSize(7.5).font('Helvetica').fillColor('#1E40AF').text(`Completed out of ${data.attendance.totalSessions} sessions`, kpi2X + 10, currentY + 44);

        // KPI 3: Absences
        const kpi3X = kpi2X + kpiWidth + kpiGap;
        doc.roundedRect(kpi3X, currentY, kpiWidth, 60, 6).fillAndStroke('#FFF1F2', '#FECDD3');
        doc.fillColor('#9F1239').font('Helvetica-Bold').fontSize(8).text('MISSED SESSIONS', kpi3X + 10, currentY + 10);
        doc.fillColor('#BE123C').fontSize(17).font('Helvetica-Bold').text(`${data.attendance.absentCount} Days`, kpi3X + 10, currentY + 23);
        doc.fontSize(7.5).font('Helvetica').fillColor('#9F1239').text('Logged in Academy Daily Register', kpi3X + 10, currentY + 44);

        currentY += 74;

        // =========================================================================
        // 5. ENROLLED BATCHES & TRAINING SCHEDULE
        // =========================================================================
        doc
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .fillColor(primaryDark)
          .text('TRAINING BATCHES & DOJO SCHEDULE', 36, currentY);

        currentY += 15;

        if (data.batches.length === 0) {
          doc.roundedRect(36, currentY, contentWidth, 36, 6).fillAndStroke(lightBg, borderLight);
          doc.fillColor(textMuted).fontSize(8.5).font('Helvetica').text('Active training sessions assigned per coach schedule.', 48, currentY + 13);
          currentY += 46;
        } else {
          for (const batch of data.batches.slice(0, 2)) {
            doc.roundedRect(36, currentY, contentWidth, 40, 6).fillAndStroke(lightBg, borderLight);
            doc.fillColor(textDark).font('Helvetica-Bold').fontSize(10).text(batch.name, 48, currentY + 9);
            doc.font('Helvetica').fontSize(8).fillColor(textMuted).text(batch.subject ? `Curriculum: ${batch.subject}` : 'Martial Arts Regular Dojo', 48, currentY + 23);

            const scheduleText = batch.scheduleDays && batch.scheduleDays.length > 0 ? batch.scheduleDays.join(', ') : 'Weekly Sessions';
            const timeText = batch.startTime ? `${batch.startTime} - ${batch.endTime || ''}` : 'Scheduled Time';
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(accentIndigo).text(`${scheduleText}   |   ${timeText}`, 260, currentY + 15, { align: 'right', width: 285 });

            currentY += 46;
          }
        }

        // =========================================================================
        // 6. TUITION & MEMBERSHIP FEE STATEMENT
        // =========================================================================
        doc
          .fontSize(9.5)
          .font('Helvetica-Bold')
          .fillColor(primaryDark)
          .text('TUITION & MEMBERSHIP FEE STATEMENT', 36, currentY);

        currentY += 15;

        const feeCardHeight = 72;
        doc.roundedRect(36, currentY, contentWidth, feeCardHeight, 8).fillAndStroke(lightBg, borderLight);

        doc.fillColor(textMuted).fontSize(8.5).font('Helvetica').text('Monthly Tuition / Plan Amount:', 48, currentY + 12);
        doc.fillColor(textDark).fontSize(14).font('Helvetica-Bold').text(`Rs. ${Number(data.fees.monthlyFee).toLocaleString('en-IN')}`, 48, currentY + 26);
        doc.fillColor(textMuted).fontSize(7.5).font('Helvetica').text(`Due by ${data.fees.feeDueDay}th of each month • Period: ${data.fees.billingPeriod}`, 48, currentY + 48);

        // Status Badge on Right
        const feeStatus = data.fees.currentMonthStatus || 'PENDING';
        let statusBg = '#EFF6FF';
        let statusBorder = '#BFDBFE';
        let statusText = '#1D4ED8';
        let statusLabel = 'FEE PENDING';

        if (feeStatus === 'PAID') {
          statusBg = '#F0FDF4';
          statusBorder = '#BBF7D0';
          statusText = '#15803D';
          statusLabel = 'PAID IN FULL';
        } else if (feeStatus === 'OVERDUE') {
          statusBg = '#FFF1F2';
          statusBorder = '#FECDD3';
          statusText = '#BE123C';
          statusLabel = 'OVERDUE DUES';
        } else if (feeStatus === 'PARTIAL') {
          statusBg = '#FEF3C7';
          statusBorder = '#FCD34D';
          statusText = '#B45309';
          statusLabel = 'PARTIAL PAYMENT';
        }

        const feePillX = 330;
        doc.roundedRect(feePillX, currentY + 12, 215, 24, 6).fillAndStroke(statusBg, statusBorder);
        doc.fillColor(statusText).font('Helvetica-Bold').fontSize(9).text(statusLabel, feePillX, currentY + 18, { width: 215, align: 'center' });

        if (data.fees.pendingAmount > 0) {
          doc.fillColor('#BE123C').fontSize(8.5).font('Helvetica-Bold').text(`Pending Balance: Rs. ${Number(data.fees.pendingAmount).toLocaleString('en-IN')}`, feePillX, currentY + 40, { width: 215, align: 'center' });
          const upiInstruction = data.fees.upiId ? `Pay Direct UPI: ${data.fees.upiId} (0% Fee)` : 'Scan & Pay via GPay / PhonePe (0% Fee)';
          doc.fillColor('#047857').fontSize(7.5).font('Helvetica-Bold').text(upiInstruction, feePillX, currentY + 54, { width: 215, align: 'center' });
        } else {
          doc.fillColor('#15803D').fontSize(8.5).font('Helvetica-Bold').text('✓ All dues fully cleared for this cycle', feePillX, currentY + 44, { width: 215, align: 'center' });
        }

        // =========================================================================
        // 7. FOOTER CERTIFICATION & DIGITAL SIGN-OFF
        // =========================================================================
        const footerY = 770;
        doc.rect(36, footerY, contentWidth, 0.5).fill('#CBD5E1');

        doc
          .fontSize(7)
          .font('Helvetica-Oblique')
          .fillColor('#64748B')
          .text(
            'This is a verified computer-generated athlete dossier and statement issued by Gurukul Sports & Martial Arts Academy. Valid for school athletic credit, state/national federation examination records, and guardian records.',
            36,
            footerY + 8,
            { align: 'center', width: contentWidth }
          );

        doc
          .fontSize(7.5)
          .font('Helvetica-Bold')
          .fillColor('#334155')
          .text(
            'Office of Academy Administration & Sensei Master • Gurukul Sports Academy • Maharashtra, India',
            36,
            footerY + 24,
            { align: 'center', width: contentWidth }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Generates a modern branded A4 PDF receipt buffer for payment confirmations
   */
  static async generateReceiptPdf(data: {
    receiptNumber: string;
    studentName: string;
    course?: string;
    amount: number;
    issuedAt: string;
    paymentMode: string;
    transactionRef?: string;
    academyName?: string;
    academyAddress?: string;
    academyPhone?: string;
    academyEmail?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const contentWidth = 515;

        // Header Background
        doc.rect(40, 40, contentWidth, 90).fill('#0F172A');

        // Academy Branding
        doc
          .fillColor('#F8FAFC')
          .fontSize(18)
          .font('Helvetica-Bold')
          .text(data.academyName || 'Gurukul Sports Academy', 60, 58);

        doc
          .fillColor('#94A3B8')
          .fontSize(9)
          .font('Helvetica')
          .text(data.academyAddress || 'Main Sports Campus', 60, 80)
          .text(`${data.academyEmail || 'contact@academy.com'} • ${data.academyPhone || '+91 94212 48210'}`, 60, 94);

        // Receipt Pill
        doc.roundedRect(380, 55, 155, 26, 6).fill('#059669');
        doc
          .fillColor('#FFFFFF')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text('PAID IN FULL', 380, 63, { width: 155, align: 'center' });

        doc
          .fillColor('#E2E8F0')
          .fontSize(9)
          .font('Helvetica')
          .text(`Receipt #${data.receiptNumber}`, 380, 90, { width: 155, align: 'center' });

        // Body Card
        const cardY = 150;
        doc.roundedRect(40, cardY, contentWidth, 260, 10).fillAndStroke('#FFFFFF', '#E2E8F0');

        doc
          .fillColor('#1E293B')
          .fontSize(13)
          .font('Helvetica-Bold')
          .text('Official Payment Receipt Confirmation', 60, cardY + 20);

        doc.rect(60, cardY + 42, contentWidth - 40, 1).fill('#F1F5F9');

        const rows = [
          ['Receipt Number', `#${data.receiptNumber}`],
          ['Payment Date', new Date(data.issuedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })],
          ['Student Name', data.studentName],
          ['Discipline / Course', data.course || 'Sports & Martial Arts Training'],
          ['Payment Method', data.paymentMode || 'UPI / Direct Online'],
          ['Transaction Reference', data.transactionRef || 'VERIFIED-SETTLEMENT'],
        ];

        let rowY = cardY + 56;
        for (const [label, val] of rows) {
          doc.fillColor('#64748B').fontSize(10).font('Helvetica').text(label, 60, rowY);
          doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text(val, 240, rowY, { width: 290 });
          rowY += 26;
        }

        // Amount Box
        const amountY = cardY + 215;
        doc.roundedRect(55, amountY, contentWidth - 30, 36, 6).fill('#F0FDF4');
        doc.fillColor('#166534').fontSize(11).font('Helvetica-Bold').text('Total Amount Settled:', 70, amountY + 12);
        doc.fillColor('#15803D').fontSize(14).font('Helvetica-Bold').text(`Rs. ${Number(data.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 350, amountY + 10, { width: 185, align: 'right' });

        // Verification Footer
        const footerY = 720;
        doc.rect(40, footerY, contentWidth, 0.5).fill('#CBD5E1');
        doc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#64748B')
          .text(
            'Official digitally verified payment confirmation issued by Academy Accounts Department.',
            40,
            footerY + 15,
            { align: 'center', width: contentWidth }
          )
          .text(
            'Thank you for your timely payment and dedication to athletic excellence.',
            40,
            footerY + 30,
            { align: 'center', width: contentWidth }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
