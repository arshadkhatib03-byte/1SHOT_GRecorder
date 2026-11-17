import React, { useState } from 'react';
import { Download, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap"
      >
        <Download className="h-3.5 w-3.5 text-emerald-400" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5 text-emerald-400" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#13161D] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-white">
                  Install on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm leading-relaxed text-slate-300">
                1. Tap the <strong>Share</strong> button in the Safari toolbar.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-lg bg-white py-2 text-sm font-semibold text-slate-950 hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-[#181C24] px-3.5 py-2 text-xs font-medium text-amber-200 shadow-lg md:bottom-4"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-400" />
      <span>Offline Mode — Local capture and saved clips remain available.</span>
    </div>
  );
};
