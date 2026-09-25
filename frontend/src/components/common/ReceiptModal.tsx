import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Printer } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Badge } from '../ui/Badge';
import { getApiUrl } from '../../lib/api';

interface ReceiptModalProps {
  receiptId: string | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ receiptId, onClose }) => {
  const { token, role, user } = useAuth();
  const isDemo = role === 'DEMO_ADMIN' || user?.isTrial;
  const defaultAcademyName = isDemo ? 'Effort Career Classes' : 'Gurukul Sports Academy';
  const [loading, setLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!receiptId) {
      setReceiptData(null);
      return;
    }

    const fetchReceipt = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(getApiUrl(`/receipts/${receiptId}`), {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error?.message || 'Failed to load receipt');
        }
        setReceiptData(json.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [receiptId, token]);

  if (!receiptId) return null;

  const handlePrint = () => {
    const url = getApiUrl(`/receipts/${receiptId}/pdf${token ? `?token=${encodeURIComponent(token)}` : ''}`);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.focus();
    }
  };

  const receipt = receiptData?.receipt;
  const academy = receiptData?.academy;
  const student = receipt?.student;
  const payment = receipt?.payment;

  return (
    <Modal isOpen={Boolean(receiptId)} onClose={onClose} title="Official Payment Receipt Preview" maxWidth="lg">
      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 text-sm rounded-xl border border-rose-200 dark:border-rose-800">
          {error}
        </div>
      ) : receipt ? (
        <div className="space-y-6">
          {/* Printable Receipt Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden">
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500" />

            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-4 pt-1">
              <div className="flex items-center gap-3">
                {academy?.logo_url && (
                  <img
                    src={academy.logo_url}
                    alt={academy.name || 'Academy Logo'}
                    className="w-12 h-12 rounded-xl object-contain border border-slate-200 dark:border-slate-700 p-1 bg-white shadow-xs flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div>
                  <h3 className="text-lg font-extrabold text-indigo-950 dark:text-indigo-300 tracking-tight">
                    {academy?.name && (isDemo ? (academy.name !== 'Gurukul Sports Academy' ? academy.name : defaultAcademyName) : academy.name) || defaultAcademyName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{academy?.address || 'Main Campus'}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {academy?.contact_email} {academy?.contact_phone && `• ${academy.contact_phone}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant="success" dot={true}>
                  PAID IN FULL
                </Badge>
                <div className="font-mono text-sm font-bold text-slate-900 dark:text-white mt-1.5">
                  #{receipt.receipt_number}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                  {new Date(receipt.issued_at).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Student Name</span>
                <span className="font-bold text-slate-900 dark:text-white">{student?.name || 'N/A'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Course / Batch</span>
                <span className="font-medium text-slate-900 dark:text-slate-200">{student?.course || 'General'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Payment Mode</span>
                <span className="font-semibold text-slate-900 dark:text-slate-200">{payment?.provider || 'MANUAL'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Transaction Ref</span>
                <span className="font-mono text-xs text-slate-600 dark:text-slate-300">
                  {payment?.provider_payment_id || payment?.id || '—'}
                </span>
              </div>
              <div className="py-3.5 flex justify-between items-center text-base font-extrabold border-t border-slate-200 dark:border-slate-800">
                <span className="text-slate-900 dark:text-white">Total Amount Settled</span>
                <span className="text-emerald-700 dark:text-emerald-400 text-lg">
                  ₹{Number(receipt.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-2">
            <div className="text-xs text-slate-400 dark:text-slate-500">Official digitally verifiable receipt</div>
            <div className="flex items-center gap-2.5">
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                Print / PDF
              </Button>
              <Button onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
};
