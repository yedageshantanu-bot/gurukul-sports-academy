import React from 'react';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Gurukul Sports Academy',
  subMessage = 'Loading your workspace...',
}) => {
  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 select-none">
      {/* Background glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Logo Container with pulse */}
        <div className="relative mb-6">
          <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 p-2 shadow-2xl flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Gurukul Sports Academy"
              className="w-16 h-16 object-contain"
              onError={(e) => {
                // Fallback shield icon if image not yet loaded
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-500/30 to-indigo-500/30 blur-sm -z-10 animate-pulse" />
        </div>

        {/* Spinner */}
        <div className="w-8 h-8 rounded-full border-[3px] border-slate-800 border-t-orange-500 animate-spin mb-4" />

        <h3 className="text-lg font-bold text-white tracking-tight mb-1">
          {message}
        </h3>
        <p className="text-xs text-slate-400 font-medium">
          {subMessage}
        </p>
      </div>
    </div>
  );
};
