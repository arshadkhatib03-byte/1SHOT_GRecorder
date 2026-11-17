import React from 'react';
import { Square, Video } from 'lucide-react';
import type { CaptureState } from '../types/recorder';
import type { Translations } from '../i18n/translations';

interface HeaderProps {
  t: Translations['nav'];
  captureState: CaptureState;
  onPrimaryAction: () => void;
}

export const Header: React.FC<HeaderProps> = ({ t, captureState, onPrimaryAction }) => {
  const isBusy = captureState === 'recording' || captureState === 'paused' || captureState === 'countdown';

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#0B0D11]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
        >
          FrameZero
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <a
            href="#studio"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4"
          >
            {t.studio}
          </a>
          <a
            href="#presets"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4"
          >
            {t.presets}
          </a>
          <a
            href="#clips"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4"
          >
            {t.clips}
          </a>
          <a
            href="#smoothness"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 hover:underline underline-offset-4"
          >
            {t.smoothness}
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0D11] ${
              isBusy
                ? 'bg-rose-600 text-white hover:bg-rose-500'
                : 'bg-white text-slate-950 hover:bg-slate-200'
            }`}
          >
            {isBusy ? <Square className="h-4 w-4 fill-current" /> : <Video className="h-4 w-4" />}
            <span>{isBusy ? t.stopCapture : t.startCapture}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
