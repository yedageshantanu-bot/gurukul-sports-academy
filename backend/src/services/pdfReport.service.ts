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
  academyName?: string;
  logoUrl?: string;
}

export class PdfReportService {
  /**
   * Generates a branded, colorful A4 PDF document buffer for student monthly progress & fees
   */
  static async generateStudentMonthlyReportPdf(data: StudentReportData): Promise<Buffer> {
    // Resolve logo image buffer ahead of PDF stream
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
          margin: 40,
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const academyName = data.academyName || 'ACADEMY CRM & COACHING INSTITUTE';
        const primaryColor = '#4F46E5'; // Indigo
        const secondaryColor = '#0EA5E9'; // Sky
        const darkTextColor = '#1E293B'; // Slate 800
        const lightGrayColor = '#F8FAFC'; // Slate 50
        const borderColor = '#E2E8F0'; // Slate 200

        // 1. HEADER BANNER (Top Gradient-like Bar)
        doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);

        let textStartX = 40;

        // Render logo if present
        if (imgBuffer) {
          try {
            // Draw clean white background card for logo in header
            doc.roundedRect(40, 20, 60, 60, 8).fill('#FFFFFF');
            doc.image(imgBuffer, 44, 24, { fit: [52, 52], align: 'center', valign: 'center' });
            textStartX = 115;
          } catch (e) {
            console.error('PDF logo embed fallback:', e);
            textStartX = 40;
          }
        }

        // Academy Title
        doc
          .fillColor('#FFFFFF')
          .fontSize(18)
          .font('Helvetica-Bold')
          .text(academyName.toUpperCase(), textStartX, 30, { align: 'left', width: 555 - textStartX });

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor('#E0E7FF')
          .text(`Official Monthly Student Progress & Fee Report — ${data.fees.billingPeriod}`, textStartX, 58, {
            align: 'left',
            width: 555 - textStartX,
          });

        doc.fillColor(darkTextColor); // Reset text color
        let currentY = 120;

        // 2. STUDENT & PARENT PROFILE CARD
        doc
          .roundedRect(40, currentY, 515, 95, 8)
          .fillAndStroke(lightGrayColor, borderColor);

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('STUDENT INFORMATION', 55, currentY + 12);

        doc.fillColor(darkTextColor).font('Helvetica-Bold').fontSize(14);
        doc.text(data.studentName, 55, currentY + 28);

        doc.font('Helvetica').fontSize(9).fillColor('#64748B');
        doc.text(`Course / Stream: `, 55, currentY + 48, { continued: true });
        doc.font('Helvetica-Bold').fillColor(darkTextColor).text(data.course || 'General');

        doc.font('Helvetica').fontSize(9).fillColor('#64748B');
        doc.text(`Parent / Guardian: `, 55, currentY + 63, { continued: true });
        doc.font('Helvetica-Bold').fillColor(darkTextColor).text(data.parentName || 'N/A');

        // Right side of card
        const col2X = 320;
        doc.font('Helvetica').fontSize(9).fillColor('#64748B');
        doc.text(`Parent WhatsApp: `, col2X, currentY + 32, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#059669').text(data.parentWhatsapp || 'None');

        doc.font('Helvetica').fontSize(9).fillColor('#64748B');
        doc.text(`Student Mobile: `, col2X, currentY + 48, { continued: true });
        doc.font('Helvetica-Bold').fillColor(darkTextColor).text(data.studentMobile || 'None');

        doc.font('Helvetica').fontSize(9).fillColor('#64748B');
        doc.text(`Admission Date: `, col2X, currentY + 63, { continued: true });
        doc.font('Helvetica-Bold').fillColor(darkTextColor).text(data.admissionDate || 'Enrolled');

        currentY += 115;

        // 3. ATTENDANCE & PERFORMANCE SUMMARY (3 KPI Blocks)
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('ATTENDANCE PERFORMANCE', 40, currentY);

        currentY += 18;

        const kpiWidth = 163;
        const kpiGap = 13;

        // KPI 1: Attendance Rate
        doc.roundedRect(40, currentY, kpiWidth, 65, 6).fillAndStroke('#F0FDF4', '#BBF7D0');
        doc.fillColor('#166534').font('Helvetica-Bold').fontSize(9).text('ATTENDANCE RATE', 52, currentY + 12);
        doc.fillColor('#15803D').fontSize(18).text(`${data.attendance.attendanceRate}%`, 52, currentY + 28);
        doc.fontSize(8).fillColor('#166534').text('Good attendance track', 52, currentY + 50);

        // KPI 2: Present Count
        const kpi2X = 40 + kpiWidth + kpiGap;
        doc.roundedRect(kpi2X, currentY, kpiWidth, 65, 6).fillAndStroke('#EFF6FF', '#BFDBFE');
        doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(9).text('CLASSES ATTENDED', kpi2X + 12, currentY + 12);
        doc.fillColor('#1D4ED8').fontSize(18).text(`${data.attendance.presentCount} Sessions`, kpi2X + 12, currentY + 28);
        doc.fontSize(8).fillColor('#1E40AF').text(`Out of ${data.attendance.totalSessions} total held`, kpi2X + 12, currentY + 50);

        // KPI 3: Absences
        const kpi3X = kpi2X + kpiWidth + kpiGap;
        doc.roundedRect(kpi3X, currentY, kpiWidth, 65, 6).fillAndStroke('#FFF1F2', '#FECDD3');
        doc.fillColor('#9F1239').font('Helvetica-Bold').fontSize(9).text('DAYS ABSENT', kpi3X + 12, currentY + 12);
        doc.fillColor('#BE123C').fontSize(18).text(`${data.attendance.absentCount} Days`, kpi3X + 12, currentY + 28);
        doc.fontSize(8).fillColor('#9F1239').text('Parent notified via WhatsApp', kpi3X + 12, currentY + 50);

        currentY += 85;

        // 4. ENROLLED BATCHES & TIMINGS
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('ENROLLED BATCHES & SCHEDULE', 40, currentY);

        currentY += 18;

        if (data.batches.length === 0) {
          doc
            .roundedRect(40, currentY, 515, 40, 6)
            .fillAndStroke(lightGrayColor, borderColor);
          doc.fillColor('#64748B').fontSize(9).text('No active batches currently assigned.', 55, currentY + 15);
          currentY += 55;
        } else {
          for (const batch of data.batches) {
            doc
              .roundedRect(40, currentY, 515, 48, 6)
              .fillAndStroke(lightGrayColor, borderColor);

            doc.fillColor(darkTextColor).font('Helvetica-Bold').fontSize(11).text(batch.name, 55, currentY + 10);
            doc.font('Helvetica').fontSize(9).fillColor('#64748B').text(batch.subject ? `Subject: ${batch.subject}` : 'Primary Academic Batch', 55, currentY + 26);

            const scheduleText = batch.scheduleDays && batch.scheduleDays.length > 0 ? batch.scheduleDays.join(', ') : 'All Week';
            const timeText = batch.startTime ? `${batch.startTime} - ${batch.endTime || ''}` : 'Scheduled';

            doc.font('Helvetica-Bold').fontSize(9).fillColor(primaryColor).text(`${scheduleText}  |  ${timeText}`, 300, currentY + 18, { align: 'right', width: 240 });

            currentY += 56;
          }
        }

        currentY += 10;

        // 5. MONTHLY FEE & BILLING STATUS
        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text('FEE & PAYMENT SUMMARY', 40, currentY);

        currentY += 18;

        doc
          .roundedRect(40, currentY, 515, 95, 8)
          .fillAndStroke(lightGrayColor, borderColor);

        doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('Monthly Tuition Fee:', 55, currentY + 15);
        doc.fillColor(darkTextColor).fontSize(14).font('Helvetica-Bold').text(`Rs. ${Number(data.fees.monthlyFee).toLocaleString('en-IN')}`, 55, currentY + 30);
        doc.fillColor('#64748B').fontSize(8).font('Helvetica').text(`Due by ${data.fees.feeDueDay}th of each month`, 55, currentY + 50);

        // Status Badge on Right
        doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('Payment Status:', 320, currentY + 15);

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

        doc.roundedRect(320, currentY + 30, 120, 26, 13).fillAndStroke(statusBg, statusBorder);
        doc.fillColor(statusText).font('Helvetica-Bold').fontSize(10).text(feeStatus, 320, currentY + 37, { width: 120, align: 'center' });

        if (data.fees.pendingAmount > 0) {
          doc.fillColor('#BE123C').fontSize(9).font('Helvetica-Bold').text(`Pending Balance: Rs. ${Number(data.fees.pendingAmount).toLocaleString('en-IN')}`, 320, currentY + 65);
        } else {
          doc.fillColor('#15803D').fontSize(9).font('Helvetica-Bold').text('All dues cleared for this month!', 320, currentY + 65);
        }

        currentY += 120;

        // 6. FOOTER REMARKS & SEAL
        doc
          .fontSize(8)
          .font('Helvetica-Oblique')
          .fillColor('#94A3B8')
          .text(
            'This is a verified computer-generated monthly progress and fee statement issued by Academy CRM. For questions regarding schedules or fees, please contact the academy administration.',
            40,
            750,
            { align: 'center', width: 515 }
          );

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
