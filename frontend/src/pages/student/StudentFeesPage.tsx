import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  FileText, 
  IndianRupee, 
  Clock, 
  ExternalLink,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

export const StudentFeesPage: React.FC = () => {
  const { token } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['student-fees-details'],
    queryFn: async () => {
      const res = await fetch(getApiUrl('/student-portal/fees'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      return json.data;
    },
    enabled: !!token,
  });

  const hasDues = (data?.totalPendingAmount || 0) > 0;
  const monthlyFee = data?.monthlyFee || 700;
  const receipts = data?.receipts || [];

  const handleDownloadBlob = async (receipt: any) => {
    try {
      setDownloadingId(receipt.id);
      const res = await fetch(getApiUrl(`/student-portal/receipt/${receipt.id}/pdf`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Receipt_${receipt.receipt_number || receipt.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      // Fallback: open in new tab
      window.open(getApiUrl(`/student-portal/receipt/${receipt.id}/pdf?token=${token}`), '_blank');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-purple-400" />
          Fees & Official Receipts
        </h2>
        <p className="text-xs text-slate-400">
          Track your monthly training fee schedule, dues status, and download verified PDF receipts.
        </p>
      </div>

      {/* Fee Status Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Monthly Batch Fee</span>
          <div className="text-2xl md:text-3xl font-black text-white flex items-center">
            <IndianRupee className="w-6 h-6 text-slate-400" />
            {isLoading ? '...' : monthlyFee}
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Due on {data?.feeDueDay || 5}th of every month</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Outstanding Balance</span>
          <div className={`text-2xl md:text-3xl font-black flex items-center ${hasDues ? 'text-amber-400' : 'text-emerald-400'}`}>
            <IndianRupee className="w-6 h-6" />
            {isLoading ? '...' : (data?.totalPendingAmount || 0)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {hasDues ? `${data?.pendingCount || 1} pending invoice` : 'All training dues clear'}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Account Standing</span>
            <div className="flex items-center gap-2">
              {hasDues ? (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold text-amber-300">Payment Due</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-bold text-emerald-300">In Good Standing</span>
                </>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            Pay direct at academy desk or via 0% fee UPI transfer.
          </p>
        </div>
      </div>

      {/* Batch Fee Breakdown Info */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">MMA & Combat Sparring (Kalarippayattu Squad)</h4>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Standard Training Fee: <strong className="text-emerald-400 font-bold">₹{monthlyFee} / month</strong> • Includes sparring, forms & belt review.
            </p>
          </div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold self-start sm:self-auto">
          Active Subscription
        </div>
      </div>

      {/* Official Receipts History */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            Official Payment Receipts (PDF)
          </h3>
          <span className="text-xs text-slate-400 font-medium">{receipts.length} Verified Receipt(s)</span>
        </div>

        {receipts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs bg-slate-950/40 rounded-2xl border border-dashed border-slate-800 p-6">
            <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="font-semibold text-white">No Receipts Generated Yet</p>
            <p className="text-slate-500 mt-0.5">Receipts will appear here immediately upon fee payment confirmation.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {receipts.map((receipt: any) => {
              const isDownloading = downloadingId === receipt.id;
              const formattedDate = receipt.issued_at || receipt.receipt_date
                ? new Date(receipt.issued_at || receipt.receipt_date).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : 'Recent';

              return (
                <div
                  key={receipt.id}
                  className="bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm md:text-base font-bold text-white">
                          Receipt #{receipt.receipt_number || receipt.id.slice(0, 8)}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          PAID
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          {formattedDate}
                        </span>
                        <span>•</span>
                        <span>Mode: {receipt.payment_mode || 'Cash/Direct UPI'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <div className="text-right sm:mr-2">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">Amount</span>
                      <span className="text-base md:text-lg font-black text-white">₹{receipt.amount}.00</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Direct 1-Click Download Button */}
                      <button
                        onClick={() => handleDownloadBlob(receipt)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/20 border border-purple-400/30 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                        {isDownloading ? 'Generating...' : 'Download PDF'}
                      </button>

                      {/* View / Print in Tab */}
                      <a
                        href={getApiUrl(`/student-portal/receipt/${receipt.id}/pdf?token=${token}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                        title="Open in new window to Print"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
