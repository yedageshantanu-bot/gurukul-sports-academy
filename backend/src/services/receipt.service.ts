import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middlewares/errorHandler.js';
import { env } from '../config/env.js';
import { requestContext } from '../config/requestContext.js';
import { ROLES } from '../constants/index.js';

export class ReceiptService {
  private get supabase() {
    if (!supabaseAdmin) {
      throw new AppError('Database connection unavailable', 500);
    }
    return supabaseAdmin;
  }

  // ============================================================================
  // 1. GET RECEIPT BY ID
  // ============================================================================
  async getReceiptById(id: string) {
    const { data: receipt, error } = await this.supabase
      .from('receipts')
      .select(`
        id,
        receipt_number,
        amount,
        issued_at,
        pdf_url,
        created_at,
        student:students(
          id,
          name,
          course,
          parent_name,
          parent_whatsapp,
          student_mobile
        ),
        payment:payments(
          id,
          amount,
          provider,
          provider_payment_id,
          provider_order_id,
          status,
          paid_at,
          created_at
        )
      `)
      .or(`id.eq.${id},receipt_number.eq.${id}`)
      .single();

    if (error || !receipt) {
      throw new AppError('Receipt not found', 404, 'RESOURCE_NOT_FOUND');
    }

    const payment = receipt.payment as any;
    if (payment && payment.status !== 'SUCCESS') {
      throw new AppError('Receipt cannot be retrieved for a payment that is not successful', 400, 'INVALID_PAYMENT_STATUS');
    }

    // Fetch academy settings for branding details
    const { data: academy } = await this.supabase
      .from('academy_settings')
      .select('academy_name, logo_url, phone, email, address, website, currency')
      .limit(1)
      .maybeSingle();

    const isDemo =
      env.DEMO_MODE ||
      env.APP_ENV === 'demo' ||
      requestContext.getStore()?.user?.role === ROLES.DEMO_ADMIN ||
      requestContext.getStore()?.user?.isTrial;
    const defaultName = isDemo ? 'Effort Career Classes' : 'Gurukul Sports Academy';

    return {
      receipt,
      academy: academy ? {
        name: academy.academy_name,
        contact_email: academy.email,
        contact_phone: academy.phone,
        address: academy.address,
        logo_url: academy.logo_url,
        website: academy.website,
      } : {
        name: defaultName,
        contact_email: isDemo ? 'effortcareer1510@gmail.com' : 'contact@apexacademy.edu',
        contact_phone: isDemo ? '+918308510975' : '+91 98765 43210',
        address: isDemo ? '3rd Floor, Arihant Mall, Near S. T. Stop, Ratnagiri, Maharashtra, India' : '123 Education Boulevard, Tech City',
      },
    };
  }

  // ============================================================================
  // 2. GET PRINTABLE RECEIPT HTML
  // ============================================================================
  async getReceiptHtml(id: string): Promise<string> {
    const { receipt, academy } = await this.getReceiptById(id);
    const student = (receipt as any).student || {};
    const payment = (receipt as any).payment || {};

    const formattedDate = new Date(receipt.issued_at).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${receipt.receipt_number}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #1e293b; }
    .receipt-box { max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { display: flex; justify-content: space-between; border-b: 2px solid #f1f5f9; padding-bottom: 20px; }
    .title { font-size: 24px; font-weight: bold; color: #4338ca; }
    .meta { font-size: 13px; color: #64748b; line-height: 1.5; }
    .badge { display: inline-block; padding: 4px 10px; background: #ecfdf5; color: #059669; font-weight: 600; border-radius: 9999px; font-size: 12px; }
    .details-table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 14px; }
    .details-table td { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .details-table td.label { color: #64748b; font-weight: 500; width: 40%; }
    .details-table td.value { color: #0f172a; font-weight: 600; text-align: right; }
    .total-row { font-size: 18px; color: #4338ca; }
    .footer { margin-top: 32px; text-align: center; font-size: 12px; color: #94a3b8; }
    @media print { body { margin: 0; } .receipt-box { border: none; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="receipt-box">
    <div class="header">
      <div style="display: flex; align-items: center; gap: 14px;">
        ${academy.logo_url ? `<img src="${academy.logo_url}" alt="${academy.name} Logo" style="width: 52px; height: 52px; object-fit: contain; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; padding: 3px; flex-shrink: 0;" />` : ''}
        <div>
          <div class="title">${academy.name}</div>
          <div class="meta">${academy.address || ''}<br>${academy.contact_email || ''} | ${academy.contact_phone || ''}</div>
        </div>
      </div>
      <div style="text-align: right;">
        <span class="badge">PAID</span>
        <div style="margin-top: 8px; font-size: 14px; font-weight: bold;">${receipt.receipt_number}</div>
        <div class="meta">${formattedDate}</div>
      </div>
    </div>

    <table class="details-table">
      <tr>
        <td class="label">Student Name</td>
        <td class="value">${student.name || 'N/A'}</td>
      </tr>
      <tr>
        <td class="label">Course / Program</td>
        <td class="value">${student.course || 'General'}</td>
      </tr>
      <tr>
        <td class="label">Parent / Contact</td>
        <td class="value">${student.parent_name || 'N/A'} (${student.parent_whatsapp || student.student_mobile || 'N/A'})</td>
      </tr>
      <tr>
        <td class="label">Payment Provider</td>
        <td class="value">${payment.provider || 'N/A'}</td>
      </tr>
      <tr>
        <td class="label">Transaction Ref</td>
        <td class="value" style="font-family: monospace; font-size: 12px;">${payment.provider_payment_id || payment.id}</td>
      </tr>
      <tr>
        <td class="label total-row">Amount Paid</td>
        <td class="value total-row">₹${Number(receipt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
      </tr>
    </table>

    <div class="footer">
      <p>Thank you for your payment. This is a computer-generated receipt and requires no physical signature.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

export const receiptService = new ReceiptService();
