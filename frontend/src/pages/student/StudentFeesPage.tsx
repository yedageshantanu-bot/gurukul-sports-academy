import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, CheckCircle2, AlertCircle, Download, FileText, IndianRupee } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getApiUrl } from '../../lib/api';

export const StudentFeesPage: React.FC = () => {
  const { token } = useAuth();

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

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-purple-400" />
          Fee Status & Official Receipts
        </h2>
        <p className="text-xs text-slate-400">
          View your fee plan, pending dues status, and download official payment receipts.
        </p>
      </div>

      {/* Fee Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Monthly Subscription</span>
          <div className="text-2xl md:text-3xl font-black text-white flex items-center">
            <IndianRupee className="w-6 h-6 text-slate-400" />
            {isLoading ? '...' : (data?.monthlyFee || 0)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">Due on {data?.feeDueDay || 5}th of every month</span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Pending Balance</span>
          <div className={`text-2xl md:text-3xl font-black flex items-center ${hasDues ? 'text-amber-400' : 'text-emerald-400'}`}>
            <IndianRupee className="w-6 h-6" />
            {isLoading ? '...' : (data?.totalPendingAmount || 0)}
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            {hasDues ? `${data?.pendingCount || 1} pending invoice(s)` : 'All academy dues cleared'}
          </span>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-1">Account Standing</span>
            <div className="flex items-center gap-2">
              {hasDues ? (
                <>
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <span className="text-sm font-bold text-amber-300">Payment Pending</span>
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
            Pay at the academy counter or contact admin for UPI payment link.
          </p>
        </div>
      </div>

      {/* Official Receipts History */}
      <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-purple-400" />
          Official Payment Receipts (PDF)
        </h3>

        {(data?.receipts || []).length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-dashed border-slate-800">
            No receipts generated yet.
          </div>
        ) : (
          <div className="space-y-2">
            {(data?.receipts || []).map((receipt: any) => (
              <div
                key={receipt.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      Receipt #{receipt.receipt_number || receipt.id.slice(0, 8)}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        PAID
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Date: {receipt.receipt_date ? new Date(receipt.receipt_date).toLocaleDateString('en-IN') : 'Recent'} • Mode: {receipt.payment_mode || 'Cash/UPI'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                  <span className="text-base font-black text-white">₹{receipt.amount}</span>
                  <a
                    href={getApiUrl(`/receipts/${receipt.id}/pdf?token=${token}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
