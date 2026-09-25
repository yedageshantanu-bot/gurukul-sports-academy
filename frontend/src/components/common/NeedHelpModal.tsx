import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Search,
  MessageCircle,
  HelpCircle,
  ChevronRight,
  BookOpen,
  ArrowUpRight,
} from 'lucide-react';

interface NeedHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface KnowledgeItem {
  id: string;
  question: string;
  keywords: string[];
  category: string;
  answer: string[];
}

const KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    id: 'add-student',
    question: 'How do I add a student?',
    keywords: ['student', 'add', 'new', 'admission', 'enroll', 'create student'],
    category: 'Students',
    answer: [
      '1. Navigate to **Students** from the left sidebar.',
      '2. Click the **+ Add Student** button at the top right.',
      '3. Enter the student\'s full name, course/stream, admission date, parent details, and agreed monthly fee amount.',
      '4. Select which batch to enroll the student into immediately, or assign them later from the Batches page.',
      '5. Click **Save Student** to confirm.',
    ],
  },
  {
    id: 'create-batch',
    question: 'How do I create a batch?',
    keywords: ['batch', 'create', 'new batch', 'schedule', 'timing', 'days'],
    category: 'Batches',
    answer: [
      '1. Open the **Batches** page from the sidebar navigation.',
      '2. Click **+ Create Batch**.',
      '3. Provide a clear descriptive batch name (e.g. "JEE Morning (XI & XII)" or "NEET Regular Morning").',
      '4. Set the weekly active days (e.g. Monday through Saturday) and daily class timing (e.g. 08:00 AM - 11:00 AM).',
      '5. Click **Create** to activate the batch. You can now assign teachers and enroll students.',
    ],
  },
  {
    id: 'mark-attendance',
    question: 'How do I mark attendance?',
    keywords: ['attendance', 'mark', 'present', 'absent', 'daily attendance', 'sheet'],
    category: 'Attendance',
    answer: [
      '1. Go to **Attendance** in the sidebar.',
      '2. Select your **Batch** and the target date from the filters.',
      '3. The roster will prefill all currently enrolled active students.',
      '4. Mark each student as either **Present** (green) or **Absent** (rose).',
      '5. Click **Save Attendance** to record the session.',
      '*Note: In accordance with institute business rules, only Present and Absent states are tracked.*',
    ],
  },
  {
    id: 'edit-attendance',
    question: 'How do I edit or correct attendance?',
    keywords: ['edit attendance', 'correct', 'change', 'wrong attendance'],
    category: 'Attendance',
    answer: [
      '1. In the **Attendance** section, navigate to the **History** tab.',
      '2. Filter by date and batch to find the attendance log you need to adjust.',
      '3. Click the status button or the **Edit** icon next to the student\'s entry.',
      '4. Switch the status between Present and Absent and save.',
      '5. The change is instantly reflected in student attendance percentage calculations.',
    ],
  },
  {
    id: 'check-pending-fees',
    question: 'How do I check pending fees?',
    keywords: ['pending', 'fees', 'due', 'check fees', 'unpaid', 'collection'],
    category: 'Fees & Finance',
    answer: [
      '1. Check your **Admin Dashboard** for instant real-time KPI totals: **This Month Collection** and **Pending Fees**.',
      '2. For individual student breakdowns, open the **Fees** page.',
      '3. Use the filter dropdown to view **Pending** or **Overdue** records.',
      '4. You can also view the student\'s monthly fee amount, due date, and payment history by clicking on their profile.',
    ],
  },
  {
    id: 'see-overdue-students',
    question: 'How do I see overdue students?',
    keywords: ['overdue', 'follow up', 'attention', 'late fees', 'delay', 'unpaid'],
    category: 'Fees & Finance',
    answer: [
      '1. On the **Admin Dashboard**, scroll down to the **Fee Follow-up Required** card.',
      '2. The system automatically categorizes and prioritizes overdue accounts:',
      '   • **3+ Months Unpaid (Critical)** — students with consecutive unpaid months.',
      '   • **Overdue** — past their designated monthly due date (typically 5th of the month).',
      '   • **Partial Due** — partial payment recorded with an outstanding balance.',
      '3. Click on any student row to view their ledger or follow up.',
    ],
  },
  {
    id: 'generate-receipt',
    question: 'How do I generate a receipt?',
    keywords: ['receipt', 'pdf', 'invoice', 'print receipt', 'download receipt'],
    category: 'Fees & Finance',
    answer: [
      '1. Navigate to **Fees** → **Student Profile** or click on any paid transaction.',
      '2. When recording a payment (Cash or UPI), a unique receipt number (e.g. `ECC-2026-1001`) is generated automatically.',
      '3. Click the **View Receipt** button to open the formatted official payment receipt.',
      '4. You can print or download the receipt PDF with institute branding.',
    ],
  },
  {
    id: 'what-does-partial-mean',
    question: 'What does PARTIAL mean?',
    keywords: ['partial', 'status', 'meaning', 'partial payment', 'installment'],
    category: 'Business Rules',
    answer: [
      '• **PARTIAL** status indicates that a student has made an initial payment towards their monthly tuition, but an outstanding balance remains.',
      '• For example: Monthly fee is ₹3,500. The parent deposited ₹2,000 in cash. The remaining ₹1,500 is marked as PARTIAL.',
      '• When the final balance is collected, the status automatically shifts from PARTIAL to **PAID**.',
    ],
  },
  {
    id: 'how-whatsapp-works',
    question: 'How does WhatsApp automation work?',
    keywords: ['whatsapp', 'automation', 'meta', 'messages', 'reminder', 'send'],
    category: 'Automation',
    answer: [
      '• WhatsApp automation in Academy CRM is engineered to deliver timely transactional updates to parents.',
      '• Automated triggers support: Absent alerts, fee payment receipts, monthly progress reports, and batch announcements.',
      '• In production, messages are sent securely via verified WhatsApp Business accounts with strict safety controls.',
      '*Note: WhatsApp sending is disabled during demo/trial mode to safeguard private communication layers.*',
    ],
  },
];

export const NeedHelpModal: React.FC<NeedHelpModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);

  if (!isOpen) return null;

  const filteredItems = searchQuery.trim()
    ? KNOWLEDGE_BASE.filter((item) => {
        const q = searchQuery.toLowerCase();
        return (
          item.question.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q)) ||
          item.answer.some((a) => a.toLowerCase().includes(q))
        );
      })
    : KNOWLEDGE_BASE;

  const supportUrl =
    'https://wa.me/919404849500?text=' +
    encodeURIComponent('Hi, I need help with Academy CRM.');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-transparent dark:from-slate-800/60 dark:to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Academy CRM Assistant
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  Instant Help
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                How can I help you today? Ask questions or select a topic below.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedItem(null);
              }}
              placeholder="Type your question (e.g., mark attendance, pending fees, partial)..."
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-sm transition-all"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {selectedItem ? (
            /* Detailed Answer View */
            <div className="space-y-4 animate-in fade-in duration-150">
              <button
                onClick={() => setSelectedItem(null)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                ← Back to all questions
              </button>

              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                    {selectedItem.category}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {selectedItem.question}
                  </h3>
                </div>

                <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed pt-2 border-t border-slate-200/60 dark:border-slate-700">
                  {selectedItem.answer.map((line, idx) => (
                    <p key={idx} className="whitespace-pre-line">
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Questions List / Suggested Chips */
            <div className="space-y-4">
              {/* Quick suggestion chips */}
              {!searchQuery && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    Popular Questions
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {KNOWLEDGE_BASE.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 dark:bg-slate-800 dark:hover:bg-blue-950/50 dark:text-slate-300 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition-colors text-left"
                      >
                        {item.question}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Filtered Question Accordions / Items */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                  {searchQuery ? `Matching Results (${filteredItems.length})` : 'All Topics'}
                </div>

                {filteredItems.length === 0 ? (
                  <div className="p-8 text-center space-y-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700">
                    <HelpCircle className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      I&apos;m not sure about that. Please contact support.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Our support team can answer complex queries directly on WhatsApp.
                    </p>
                  </div>
                ) : (
                  filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="w-full p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/40 dark:hover:bg-slate-800 transition-all flex items-center justify-between text-left group"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {item.question}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {item.category}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer with WhatsApp Support Link (9404849500) */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            Still have questions or need custom assistance?
          </div>

          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm hover:shadow transition-all group"
          >
            <MessageCircle className="w-4 h-4 fill-current" />
            <span>Still need help? Contact Support</span>
            <ArrowUpRight className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </div>
    </div>
  );
};
