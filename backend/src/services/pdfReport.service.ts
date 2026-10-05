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
  };
  martialArtsRank?: {
    disciplineName: string;
    currentRankName: string;
    beltColor: string;
    regNumber?: string;
    promotedAt?: string;
    examinerName?: string;
  };
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
            Author: data.academyName || 'Gurukul Sports Academy',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const academyName = data.academyName || 'GURUKUL SPORTS & MARTIAL ARTS ACADEMY';
        const primaryColor = '#0F172A'; // Obsidian Navy
        const accentIndigo = '#4338CA'; // Indigo
        const goldAccent = '#D97706'; // Martial Arts Gold
        const emeraldGreen = '#059669'; // Emerald
        const darkTextColor = '#0F172A'; // Slate 900
        const lightGrayColor = '#F8FAFC'; // Slate 50
        const borderColor = '#E2E8F0'; // Slate 200

        // =========================================================================
        // 1. TOP HEADER BANNER (Obsidian & Gold Line)
        // =========================================================================
        doc.rect(0, 0, doc.page.width, 90).fill(primaryColor);
        doc.rect(0, 87, doc.page.width, 3).fill(goldAccent);

        let textStartX = 36;
        if (imgBuffer) {
          try {
            doc.roundedRect(36, 16, 58, 58, 8).fill('#FFFFFF');
            doc.image(imgBuffer, 40, 20, { fit: [50, 50], align: 'center', valign: 'center' });
            textStartX = 108;
          } catch (e) {
            textStartX = 36;
          }
        }

        doc
          .fillColor('#FFFFFF')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text(academyName.toUpperCase(), textStartX, 24, { width: 520 - textStartX });

        doc
          .fontSize(9.5)
          .font('Helvetica')
          .fillColor('#FDE68A') // Pale Gold
          .text(`OFFICIAL ATHLETE PROGRESS & PERFORMANCE REPORT — ${data.fees.billingPeriod.toUpperCase()}`, textStartX, 48, {
            width: 520 - textStartX,
          });

        doc
          .fontSize(7.5)
          .fillColor('#94A3B8')
          .text(`Affiliated Martial Arts & Sports Training Center • Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, textStartX, 64);

        let currentY = 104;

        // =========================================================================
        // 2. ATHLETE & GUARDIAN PROFILE CARD
        // =========================================================================
        doc
          .roundedRect(36, currentY, 523, 76, 6)
          .fillAndStroke(lightGrayColor, borderColor);

        doc
          .fontSize(8.5)
          .font('Helvetica-Bold')
          .fillColor(accentIndigo)
          .text('ATHLETE PROFILE & DETAILS', 48, currentY + 10);

        doc.fillColor(darkTextColor).font('Helvetica-Bold').fontSize(13);
        doc.text(data.studentName, 48, currentY + 24);

        doc.font('Helvetica').fontSize(8.5).fillColor('#64748B');
        doc.text('Course / Discipline: ', 48, currentY + 42, { continued: true });
        doc.font('Helvetica-Bold').fillColor(darkTextColor).text(data.course || 'General Training');

        doc.font('Helvetica').fontSize(8.5).fillColor('#64748B');
        doc.text('Parent / Guardian: ', 48, currentY + 56, { continued: true });
        doc.font('Helvetica-Bold').fillColor(darkTextColor).text(data.parentName || 'N/A');

        // Right side of athlete card
        const col2X = 310;
        doc.font('Helvetica').fontSize(8.5).fillColor('#64748B');
        doc.text('Parent WhatsApp: ', col2X, currentY + 26, { continued: true });
        doc.font('Helvetica-Bold').fillColor(emeraldGreen).text(data.parentWhatsapp || 'None');

        doc.font('Helvetica').fontSize(8.5).fillColor('#64748B');
        doc.text('Athlete Mobile: ', col2X, currentY + 42, { continued: true });
        doc.font('Helvetica-Bold').fillColor(darkTextColor).text(data.studentMobile || 'None');

        doc.font('Helvetica').fontSize(8.5).fillColor('#64748B');
        doc.text('Admission Date: ', col2X, currentY + 56, { continued: true });
        doc.font('Helvetica-Bold').fillColor(darkTextColor).text(data.admissionDate || 'Enrolled Active');

        currentY += 88;

        // =========================================================================
        // 3. MARTIAL ARTS BELT & EXAMINATION RESULT (Requested by User)
        // =========================================================================
        if (data.martialArtsRank) {
          const rank = data.martialArtsRank;
          doc
            .roundedRect(36, currentY, 523, 72, 6)
            .fillAndStroke('#FFFBEB', '#FDE68A'); // Gold/Amber light card

          doc
            .fontSize(8.5)
            .font('Helvetica-Bold')
            .fillColor(goldAccent)
            .text('MARTIAL ARTS BELT PROGRESSION & EXAMINATION RESULT', 48, currentY + 9);

          doc.fillColor('#78350F').font('Helvetica-Bold').fontSize(13);
          doc.text(`${rank.currentRankName}  (${rank.beltColor} Belt)`, 48, currentY + 23);

          doc.font('Helvetica').fontSize(8.5).fillColor('#92400E');
          doc.text('Discipline: ', 48, currentY + 41, { continued: true });
          doc.font('Helvetica-Bold').fillColor('#78350F').text(rank.disciplineName, { continued: true });
          doc.font('Helvetica').fillColor('#92400E').text('   |   Reg No: ', { continued: true });
          doc.font('Helvetica-Bold').fillColor(goldAccent).text(rank.regNumber || 'GSA-ATH');

          doc.font('Helvetica').fontSize(8).fillColor('#B45309');
          const promDate = rank.promotedAt ? new Date(rank.promotedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Verified';
          doc.text(`Promoted On: ${promDate}   •   Certified by: ${rank.examinerName || 'Sensei / Chief Master'}`, 48, currentY + 55);

          // Status stamp pill on right
          doc.roundedRect(420, currentY + 20, 125, 30, 6).fillAndStroke('#FEF3C7', goldAccent);
          doc.fillColor(goldAccent).font('Helvetica-Bold').fontSize(9).text('CERTIFIED BELT', 420, currentY + 27, { width: 125, align: 'center' });
          doc.fontSize(7).font('Helvetica').fillColor('#92400E').text('Official Registry Entry', 420, currentY + 38, { width: 125, align: 'center' });

          currentY += 84;
        }

        // =========================================================================
        // 4. ATTENDANCE & PERFORMANCE SUMMARY (3 KPI Blocks)
        // =========================================================================
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('MONTHLY ATTENDANCE & DISCIPLINE', 36, currentY);

        currentY += 16;
        const kpiWidth = 166;
        const kpiGap = 12;

        // KPI 1: Attendance Rate
        doc.roundedRect(36, currentY, kpiWidth, 58, 6).fillAndStroke('#F0FDF4', '#BBF7D0');
        doc.fillColor('#166534').font('Helvetica-Bold').fontSize(8).text('ATTENDANCE RATE', 46, currentY + 10);
        doc.fillColor('#15803D').fontSize(16).text(`${data.attendance.attendanceRate}%`, 46, currentY + 23);
        doc.fontSize(7.5).fillColor('#166534').text(data.attendance.attendanceRate >= 80 ? 'Excellent dedication' : 'Regular practice recommended', 46, currentY + 44);

        // KPI 2: Classes Attended
        const kpi2X = 36 + kpiWidth + kpiGap;
        doc.roundedRect(kpi2X, currentY, kpiWidth, 58, 6).fillAndStroke('#EFF6FF', '#BFDBFE');
        doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(8).text('SESSIONS ATTENDED', kpi2X + 10, currentY + 10);
        doc.fillColor('#1D4ED8').fontSize(16).text(`${data.attendance.presentCount} Sessions`, kpi2X + 10, currentY + 23);
        doc.fontSize(7.5).fillColor('#1E40AF').text(`Out of ${data.attendance.totalSessions} total sessions`, kpi2X + 10, currentY + 44);

        // KPI 3: Absences
        const kpi3X = kpi2X + kpiWidth + kpiGap;
        doc.roundedRect(kpi3X, currentY, kpiWidth, 58, 6).fillAndStroke('#FFF1F2', '#FECDD3');
        doc.fillColor('#9F1239').font('Helvetica-Bold').fontSize(8).text('SESSIONS MISSED', kpi3X + 10, currentY + 10);
        doc.fillColor('#BE123C').fontSize(16).text(`${data.attendance.absentCount} Days`, kpi3X + 10, currentY + 23);
        doc.fontSize(7.5).fillColor('#9F1239').text('WhatsApp alert logged', kpi3X + 10, currentY + 44);

        currentY += 72;

        // =========================================================================
        // 5. ENROLLED BATCHES & TRAINING SCHEDULE
        // =========================================================================
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('TRAINING BATCHES & DOJO SCHEDULE', 36, currentY);

        currentY += 16;

        if (data.batches.length === 0) {
          doc.roundedRect(36, currentY, 523, 36, 6).fillAndStroke(lightGrayColor, borderColor);
          doc.fillColor('#64748B').fontSize(8.5).font('Helvetica').text('No specific batch schedule assigned for this period.', 48, currentY + 13);
          currentY += 46;
        } else {
          for (const batch of data.batches.slice(0, 2)) {
            doc.roundedRect(36, currentY, 523, 40, 6).fillAndStroke(lightGrayColor, borderColor);
            doc.fillColor(darkTextColor).font('Helvetica-Bold').fontSize(10).text(batch.name, 48, currentY + 9);
            doc.font('Helvetica').fontSize(8).fillColor('#64748B').text(batch.subject ? `Curriculum: ${batch.subject}` : 'Martial Arts Regular Batch', 48, currentY + 23);

            const scheduleText = batch.scheduleDays && batch.scheduleDays.length > 0 ? batch.scheduleDays.join(', ') : 'Weekly Sessions';
            const timeText = batch.startTime ? `${batch.startTime} - ${batch.endTime || ''}` : 'Scheduled';
            doc.font('Helvetica-Bold').fontSize(8.5).fillColor(accentIndigo).text(`${scheduleText}   |   ${timeText}`, 260, currentY + 15, { align: 'right', width: 285 });

            currentY += 46;
          }
        }

        // =========================================================================
        // 6. TUITION & MEMBERSHIP FEE SUMMARY
        // =========================================================================
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('FEES & PAYMENT STATEMENT', 36, currentY);

        currentY += 16;

        doc.roundedRect(36, currentY, 523, 76, 6).fillAndStroke(lightGrayColor, borderColor);

        doc.fillColor('#64748B').fontSize(8.5).font('Helvetica').text('Fee Billing Cycle:', 48, currentY + 12);
        doc.fillColor(darkTextColor).fontSize(14).font('Helvetica-Bold').text(`Rs. ${Number(data.fees.monthlyFee).toLocaleString('en-IN')}`, 48, currentY + 26);
        doc.fillColor('#64748B').fontSize(7.5).font('Helvetica').text(`Due by ${data.fees.feeDueDay}th of the month`, 48, currentY + 46);

        // Status Badge on Right
        const feeStatus = data.fees.currentMonthStatus || 'PENDING';
        let statusBg = '#EFF6FF';
        let statusBorder = '#BFDBFE';
        let statusText = '#1D4ED8';

        if (feeStatus === 'PAID') {
          statusBg = '#F0FDF4';
          statusBorder = '#BBF7D0';
          statusText = '#15803D';
        } else if (feeStatus === 'OVERDUE') {
          statusBg = '#FFF1F2';
          statusBorder = '#FECDD3';
          statusText = '#BE123C';
        }

        doc.roundedRect(360, currentY + 16, 180, 26, 6).fillAndStroke(statusBg, statusBorder);
        doc.fillColor(statusText).font('Helvetica-Bold').fontSize(10).text(feeStatus, 360, currentY + 23, { width: 180, align: 'center' });

        if (data.fees.pendingAmount > 0) {
          doc.fillColor('#BE123C').fontSize(8.5).font('Helvetica-Bold').text(`Pending Balance: Rs. ${Number(data.fees.pendingAmount).toLocaleString('en-IN')}`, 360, currentY + 48, { width: 180, align: 'center' });
        } else {
          doc.fillColor('#15803D').fontSize(8.5).font('Helvetica-Bold').text('All tuition dues cleared for this cycle!', 360, currentY + 48, { width: 180, align: 'center' });
        }

        // =========================================================================
        // 7. FOOTER CERTIFICATION & SEAL
        // =========================================================================
        doc
          .fontSize(7.5)
          .font('Helvetica-Oblique')
          .fillColor('#94A3B8')
          .text(
            'This is a verified computer-generated monthly progress and belt statement issued by Gurukul Sports Academy. For questions regarding belt examinations, syllabus mastery, or fee settlements, please contact the academy administration.',
            36,
            780,
            { align: 'center', width: 523 }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
