import React, { useState } from 'react';
import { Smartphone, Download, X, Share2, PlusSquare, MoreVertical, Info, CheckCircle2 } from 'lucide-react';
import { usePwaInstall } from '../../utils/pwaPrompt';

export const InstallPwaPrompt: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstalled, isIos, triggerInstall } = usePwaInstall();
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // If already installed as a standalone PWA or user dismissed this session
  if (isInstalled || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    // If iOS Safari, open iOS specific guide directly (iOS has no native beforeinstallprompt)
    if (isIos) {
      setShowManualGuide(true);
      return;
    }

    // Attempt native prompt invocation
    const result = await triggerInstall();

    if (result.method === 'native') {
      if (result.status === 'accepted') {
        console.log('[InstallPwaPrompt] Native installation accepted by user.');
      } else {
        console.log('[InstallPwaPrompt] Native installation dismissed by user.');
      }
    } else {
      // Native prompt unavailable -> show manual instructions with eligibility context
      setShowManualGuide(true);
    }
  };

  const renderManualGuideModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-sm w-full p-5 md:p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-400" />
            {isIos ? 'Install on iPhone / iPad' : 'Install on Android / Chrome'}
          </h3>
          <button
            onClick={() => setShowManualGuide(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isIos ? (
          /* iOS Safari Guide */
          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
              <Share2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Step 1: Tap Share</strong>
                Tap the Safari Share button at the bottom of the screen.
              </div>
            </div>
            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
              <PlusSquare className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-0.5">Step 2: Add to Home Screen</strong>
                Scroll down and tap <span className="text-white font-semibold">"Add to Home Screen"</span>.
              </div>
            </div>
          </div>
        ) : (
          /* Android / Chrome Manual Steps */
          <div className="space-y-3 text-xs text-slate-300">
            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 font-bold">
                <MoreVertical className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-white block mb-0.5">Step 1: Open Chrome Menu</strong>
                Tap the three-dots menu <span className="text-white font-bold">(⋮)</span> at the top-right corner of Chrome.
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 font-bold">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-white block mb-0.5">Step 2: Select Install</strong>
                Tap <span className="text-white font-bold">"Install app"</span> or <span className="text-white font-bold">"Add to Home screen"</span>.
              </div>
            </div>

            <div className="flex items-start gap-3 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-white block mb-0.5">Step 3: Confirm</strong>
                Tap <span className="text-white font-bold">"Install"</span> to place the Gurukul Sports App on your phone home screen.
              </div>
            </div>

            {/* Educational Context on Browser Eligibility & PWA Requirements */}
            <div className="p-3 rounded-2xl bg-slate-800/40 border border-slate-700/40 text-[11px] text-slate-400 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p>
                <strong>Browser Eligibility Note:</strong> Native 1-tap prompts depend on browser engagement heuristics and whether the prompt was previously dismissed. Installing via the browser menu <strong className="text-slate-300">(⋮)</strong> provides the exact same full-screen offline experience.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowManualGuide(false)}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );

  // Compact Button View (used in Header / Navigation)
  if (compact) {
    return (
      <>
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all shadow-sm active:scale-95 cursor-pointer"
        >
          <Smartphone className="w-3.5 h-3.5" />
          Install App
        </button>
        {showManualGuide && renderManualGuideModal()}
      </>
    );
  }

  // Standard Banner View (used in Dashboard & Settings)
  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 border border-blue-500/30 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <img src="/logo.png" alt="Gurukul" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Install Gurukul App on Mobile 📲
              </h4>
              <p className="text-xs text-slate-300">
                1-tap access to daily attendance, belt ranks & fee receipts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20 flex items-center gap-1.5 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Install
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showManualGuide && renderManualGuideModal()}
    </>
  );
};
