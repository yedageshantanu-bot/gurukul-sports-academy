import PDFDocument from 'pdfkit';
import { supabaseAdmin } from '../config/supabase.js';
import { announcementService } from './announcement.service.js';

export interface PastScheduledMessageRecord {
  id: string;
  batchId: string;
  slotTag?: string;
  recipientName: string;
  recipientPhone: string;
  messageContent: string;
  scheduledAt: string;
  finalStatus: 'SENT' | 'FAILED' | 'MISSED (QR / WhatsApp Disconnected)';
  failureReason?: string;
}

export class ScheduledPdfExportService {
  private get supabase() {
    return supabaseAdmin;
  }

  /**
   * Fetch all historical and missed scheduled messages up to right now
   */
  async getPastScheduledMessages(): Promise<{
    records: PastScheduledMessageRecord[];
    summary: {
      totalSent: number;
      totalMissed: number;
      totalFailed: number;
      totalRecords: number;
    };
  }> {
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const recordsMap = new Map<string, PastScheduledMessageRecord>();

    // 1. Gather all past slots from announcementService
    try {
      const { all } = await announcementService.listUnifiedSlots();
      for (const slot of all) {
        const schedMs = new Date(slot.scheduledAt).getTime();
        const isPast = schedMs <= nowMs;
        const isDone = slot.status === 'SENT' || slot.status === 'FAILED';

        if (isPast || isDone) {
          let finalStatus: 'SENT' | 'FAILED' | 'MISSED (QR / WhatsApp Disconnected)' = 'FAILED';
          if (slot.status === 'SENT') {
            finalStatus = 'SENT';
          } else if (slot.status === 'SCHEDULED' || slot.status === 'PENDING' || slot.status === 'SENDING') {
            // Scheduled for the past but never sent because WhatsApp gateway was disconnected/offline
            finalStatus = 'MISSED (QR / WhatsApp Disconnected)';
          } else {
            finalStatus = 'FAILED';
          }

          const batchCode = slot.batchCode || `BATCH-${slot.announcementId?.slice(0, 4).toUpperCase() || 'MAIN'}`;
          const slotTag = slot.slotTag || `Slot ${slot.slotNumber || 1}`;
          const batchId = slot.dispatchId || `${batchCode}-S${slot.slotNumber || 1}`;

          // If individual recipients are present, expand them; otherwise output slot row
          if (Array.isArray(slot.recipientList) && slot.recipientList.length > 0) {
            for (const rec of slot.recipientList) {
              const recKey = `${slot.id}:${rec.phone}`;
              if (!recordsMap.has(recKey)) {
                recordsMap.set(recKey, {
                  id: `${slot.id}-${rec.phone}`,
                  batchId,
                  slotTag,
                  recipientName: rec.name || 'Academy Student',
                  recipientPhone: rec.phone,
                  messageContent: slot.message || slot.title,
                  scheduledAt: slot.scheduledAt,
                  finalStatus,
                  failureReason: slot.errorDetails || undefined,
                });
              }
            }
          } else {
            const batchesName = (slot.batches || []).map((b) => b.name).join(', ') || 'Target Students';
            recordsMap.set(slot.id, {
              id: slot.id,
              batchId,
              slotTag,
              recipientName: batchesName,
              recipientPhone: `${slot.recipientCount || 0} Recipient(s)`,
              messageContent: slot.message || slot.title,
              scheduledAt: slot.scheduledAt,
              finalStatus,
              failureReason: slot.errorDetails || undefined,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[ScheduledPdfExport] Notice fetching announcement slots:', err.message);
    }

    // 2. Gather from whatsapp_queue for any past queued items not captured in slots
    if (this.supabase) {
      try {
        const { data: queueItems } = await this.supabase
          .from('whatsapp_queue')
          .select('*, student:students(id, name, parent_name)')
          .lte('scheduled_at', nowIso)
          .order('scheduled_at', { ascending: false })
          .limit(300);

        if (Array.isArray(queueItems)) {
          for (const item of queueItems) {
            if (recordsMap.has(item.id)) continue;

            let finalStatus: 'SENT' | 'FAILED' | 'MISSED (QR / WhatsApp Disconnected)' = 'FAILED';
            if (item.status === 'SENT' || item.status === 'MOCK' || item.status === 'OK') {
              finalStatus = 'SENT';
            } else if (item.status === 'PENDING' || item.status === 'PROCESSING') {
              finalStatus = 'MISSED (QR / WhatsApp Disconnected)';
            } else {
              finalStatus = 'FAILED';
            }

            const st = item.student as any;
            const recName = st?.name || st?.parent_name || 'Academy Student';
            const meta = item.metadata || {};
            const batchId = meta.dispatchId || meta.batchCode || (item.event_type === 'ANNOUNCEMENT' ? 'BATCH-SCHED' : `MSG-${item.id.slice(0, 6).toUpperCase()}`);

            recordsMap.set(item.id, {
              id: item.id,
              batchId,
              slotTag: meta.slotTag || 'Direct Queue',
              recipientName: recName,
              recipientPhone: item.recipient_phone,
              messageContent: item.message_body,
              scheduledAt: item.scheduled_at || item.created_at,
              finalStatus,
              failureReason: item.failure_reason || undefined,
            });
          }
        }
      } catch (err: any) {
        console.warn('[ScheduledPdfExport] Notice fetching queue items:', err.message);
      }
    }

    const records = Array.from(recordsMap.values()).sort(
      (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );

    const totalSent = records.filter((r) => r.finalStatus === 'SENT').length;
    const totalMissed = records.filter((r) => r.finalStatus === 'MISSED (QR / WhatsApp Disconnected)').length;
    const totalFailed = records.filter((r) => r.finalStatus === 'FAILED').length;

    return {
      records,
      summary: {
        totalSent,
        totalMissed,
        totalFailed,
        totalRecords: records.length,
      },
    };
  }

  /**
   * Generates a Landscape A4 PDF document containing summary cards and structured table
   */
  async generateHistoryPdf(): Promise<Buffer> {
    const { records, summary } = await this.getPastScheduledMessages();

    return new Promise<Buffer>((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'landscape',
          margin: 32,
          bufferPages: true,
          info: {
            Title: 'Gurukul Sports Academy - Scheduled Messages History & Missed Broadcasts Audit Report',
            Author: 'Gurukul Sports Academy CRM',
            Subject: 'WhatsApp Scheduled Broadcasts Export',
          },
        });

        const buffers: Buffer[] = [];
        doc.on('data', (chunk) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err) => reject(err));

        const pageWidth = 841.89;
        const pageHeight = 595.28;
        const margin = 32;
        const contentWidth = pageWidth - margin * 2; // 777.89 pt

        // --------------------------------------------------------------------
        // 1. BRANDED HEADER
        // --------------------------------------------------------------------
        // Top dark banner bar
        doc.rect(margin, margin, contentWidth, 54).fillAndStroke('#0f172a', '#1e293b');

        doc.fillColor('#f8fafc').fontSize(16).font('Helvetica-Bold')
          .text('GURUKUL SPORTS ACADEMY', margin + 16, margin + 12);

        doc.fillColor('#94a3b8').fontSize(9).font('Helvetica')
          .text('WhatsApp Scheduled Messages & Missed Broadcasts • Official Audit Export Report', margin + 16, margin + 32);

        const nowFormatted = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });

        doc.fillColor('#cbd5e1').fontSize(8).font('Helvetica-Bold')
          .text(`Generated: ${nowFormatted} (IST)`, margin, margin + 14, { align: 'right', width: contentWidth - 16 });
        doc.fillColor('#64748b').fontSize(7).font('Helvetica')
          .text('Status: Clean Export Before Permanent DB Cleanup', margin, margin + 28, { align: 'right', width: contentWidth - 16 });

        // --------------------------------------------------------------------
        // 2. SUMMARY HEADER KPI CARDS (Requirement 1: Total Sent, Missed due to QR Off, Total Failed)
        // --------------------------------------------------------------------
        const kpiY = margin + 64;
        const cardWidth = (contentWidth - 24) / 4;
        const cardHeight = 46;

        // Card 1: Total Historical Scheduled
        doc.roundedRect(margin, kpiY, cardWidth, cardHeight, 6).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('TOTAL SCHEDULED PAST', margin + 12, kpiY + 8);
        doc.fillColor('#0f172a').fontSize(16).font('Helvetica-Bold').text(summary.totalRecords.toString(), margin + 12, kpiY + 22);

        // Card 2: Total Sent (Green)
        const c2X = margin + cardWidth + 8;
        doc.roundedRect(c2X, kpiY, cardWidth, cardHeight, 6).fillAndStroke('#ecfdf5', '#a7f3d0');
        doc.fillColor('#047857').fontSize(8).font('Helvetica-Bold').text('TOTAL SENT (SUCCESS)', c2X + 12, kpiY + 8);
        doc.fillColor('#065f46').fontSize(16).font('Helvetica-Bold').text(summary.totalSent.toString(), c2X + 12, kpiY + 22);

        // Card 3: Total Missed due to QR Off (Amber)
        const c3X = margin + (cardWidth + 8) * 2;
        doc.roundedRect(c3X, kpiY, cardWidth, cardHeight, 6).fillAndStroke('#fffbeb', '#fde68a');
        doc.fillColor('#b45309').fontSize(8).font('Helvetica-Bold').text('MISSED (QR / WHATSAPP OFF)', c3X + 12, kpiY + 8);
        doc.fillColor('#92400e').fontSize(16).font('Helvetica-Bold').text(summary.totalMissed.toString(), c3X + 12, kpiY + 22);

        // Card 4: Total Failed (Red)
        const c4X = margin + (cardWidth + 8) * 3;
        doc.roundedRect(c4X, kpiY, cardWidth, cardHeight, 6).fillAndStroke('#fef2f2', '#fecaca');
        doc.fillColor('#b91c1c').fontSize(8).font('Helvetica-Bold').text('TOTAL FAILED / REJECTED', c4X + 12, kpiY + 8);
        doc.fillColor('#991b1b').fontSize(16).font('Helvetica-Bold').text(summary.totalFailed.toString(), c4X + 12, kpiY + 22);

        // --------------------------------------------------------------------
        // 3. STRUCTURED DATA TABLE
        // Columns:
        // 1. Batch / Unique ID (130 pt)
        // 2. Recipient Name & Phone (150 pt)
        // 3. Message Content (267 pt)
        // 4. Scheduled Date & Time (110 pt)
        // 5. Final Status (120 pt)
        // Total = 777 pt
        // --------------------------------------------------------------------
        const colWidths = [125, 145, 275, 110, 122];
        const colX = [
          margin,
          margin + colWidths[0],
          margin + colWidths[0] + colWidths[1],
          margin + colWidths[0] + colWidths[1] + colWidths[2],
          margin + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3],
        ];

        let currentY = kpiY + cardHeight + 14;

        const drawTableHeader = (y: number) => {
          doc.rect(margin, y, contentWidth, 22).fillAndStroke('#1e293b', '#334155');
          doc.fillColor('#f8fafc').fontSize(8).font('Helvetica-Bold');
          doc.text('BATCH / UNIQUE ID', colX[0] + 6, y + 6, { width: colWidths[0] - 12 });
          doc.text('RECIPIENT NAME & PHONE', colX[1] + 6, y + 6, { width: colWidths[1] - 12 });
          doc.text('MESSAGE CONTENT', colX[2] + 6, y + 6, { width: colWidths[2] - 12 });
          doc.text('SCHEDULED DATE & TIME', colX[3] + 6, y + 6, { width: colWidths[3] - 12 });
          doc.text('FINAL STATUS', colX[4] + 6, y + 6, { width: colWidths[4] - 12, align: 'center' });
          return y + 22;
        };

        currentY = drawTableHeader(currentY);

        if (records.length === 0) {
          doc.rect(margin, currentY, contentWidth, 50).fillAndStroke('#ffffff', '#e2e8f0');
          doc.fillColor('#64748b').fontSize(10).font('Helvetica')
            .text('No historical scheduled messages found in database.', margin, currentY + 18, { align: 'center', width: contentWidth });
          currentY += 50;
        }

        const rowHeight = 32;

        records.forEach((rec, idx) => {
          // Check for page break
          if (currentY + rowHeight > pageHeight - margin - 20) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin: 32 });
            currentY = margin + 10;
            currentY = drawTableHeader(currentY);
          }

          const isEven = idx % 2 === 0;
          const bgCol = isEven ? '#ffffff' : '#f8fafc';
          doc.rect(margin, currentY, contentWidth, rowHeight).fillAndStroke(bgCol, '#e2e8f0');

          // 1. Batch / Unique ID
          doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
            .text(rec.batchId || 'SCHED-BATCH', colX[0] + 6, currentY + 6, { width: colWidths[0] - 12 });
          if (rec.slotTag) {
            doc.fillColor('#64748b').fontSize(7).font('Helvetica')
              .text(rec.slotTag, colX[0] + 6, currentY + 17, { width: colWidths[0] - 12 });
          }

          // 2. Recipient Name & Phone
          doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold')
            .text(rec.recipientName || 'Student', colX[1] + 6, currentY + 6, { width: colWidths[1] - 12, ellipsis: true });
          doc.fillColor('#475569').fontSize(7.5).font('Helvetica')
            .text(rec.recipientPhone || 'Unsaved CRM', colX[1] + 6, currentY + 17, { width: colWidths[1] - 12 });

          // 3. Message Content (cleanly truncated or wrapped)
          const cleanBody = (rec.messageContent || '')
            .replace(/[*_~`]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
            .text(cleanBody, colX[2] + 6, currentY + 6, {
              width: colWidths[2] - 12,
              height: rowHeight - 10,
              ellipsis: true,
            });

          // 4. Scheduled Date & Time
          let schedText = 'Past Due';
          if (rec.scheduledAt) {
            try {
              schedText = new Date(rec.scheduledAt).toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });
            } catch {
              schedText = rec.scheduledAt;
            }
          }
          doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
            .text(schedText, colX[3] + 6, currentY + 10, { width: colWidths[3] - 12 });

          // 5. Final Status Badge
          const badgeX = colX[4] + 8;
          const badgeY = currentY + 6;
          const badgeW = colWidths[4] - 16;
          const badgeH = 18;

          if (rec.finalStatus === 'SENT') {
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4).fillAndStroke('#dcfce7', '#86efac');
            doc.fillColor('#15803d').fontSize(7.5).font('Helvetica-Bold')
              .text('SENT', badgeX, badgeY + 4, { align: 'center', width: badgeW });
          } else if (rec.finalStatus === 'MISSED (QR / WhatsApp Disconnected)') {
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4).fillAndStroke('#fef3c7', '#fcd34d');
            doc.fillColor('#b45309').fontSize(6.5).font('Helvetica-Bold')
              .text('MISSED (QR OFF)', badgeX, badgeY + 5, { align: 'center', width: badgeW });
          } else {
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4).fillAndStroke('#fee2e2', '#fca5a5');
            doc.fillColor('#b91c1c').fontSize(7.5).font('Helvetica-Bold')
              .text('FAILED', badgeX, badgeY + 4, { align: 'center', width: badgeW });
          }

          currentY += rowHeight;
        });

        // --------------------------------------------------------------------
        // FOOTER ON ALL PAGES
        // --------------------------------------------------------------------
        const totalPages = doc.bufferedPageRange().count;
        for (let p = 0; p < totalPages; p++) {
          doc.switchToPage(p);
          doc.fillColor('#94a3b8').fontSize(7).font('Helvetica')
            .text(
              `Gurukul Sports Academy CRM • Historical Messages Audit Report • Page ${p + 1} of ${totalPages}`,
              margin,
              pageHeight - margin + 8,
              { align: 'center', width: contentWidth }
            );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export const scheduledPdfExportService = new ScheduledPdfExportService();
