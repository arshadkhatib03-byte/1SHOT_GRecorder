import React from 'react';
import { Mic, MicOff, Square, Video } from 'lucide-react';
import type { CaptureState } from '../types/recorder';
import type { Translations } from '../i18n/translations';
import { formatDuration } from '../utils/captureEngine';

interface MobileBottomBarProps {
  t: Translations['hero'];
  navT: Translations['nav'];
  captureState: CaptureState;
  elapsedSeconds: number;
  micEnabled: boolean;
  isMicMutedLive: boolean;
  onPrimaryAction: () => void;
  onToggleMic: () => void;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  t,
  navT,
  captureState,
  elapsedSeconds,
  micEnabled,
  isMicMutedLive,
  onPrimaryAction,
  onToggleMic,
}) => {
  const isBusy =
    captureState === 'recording' || captureState === 'paused' || captureState === 'countdown';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#0B0D11]/95 backdrop-blur-md px-4 py-2.5 md:hidden">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleMic}
          className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
            (isBusy ? isMicMutedLive : !micEnabled)
              ? 'border-white/10 bg-white/5 text-slate-400'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
          aria-label={isMicMutedLive ? t.unmuteMic : t.muteMic}
        >
          {(isBusy ? isMicMutedLive : !micEnabled) ? (
            <MicOff className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
          <span className="font-mono">
            {isBusy ? formatDuration(elapsedSeconds) : micEnabled ? 'Mic' : 'Muted'}
          </span>
        </button>

        <button
          type="button"
          onClick={onPrimaryAction}
          className={`flex-1 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
            isBusy
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'bg-white text-slate-950 hover:bg-slate-200'
          }`}
        >
          {isBusy ? <Square className="h-4 w-4 fill-current" /> : <Video className="h-4 w-4" />}
          <span>{isBusy ? navT.stopCapture : navT.startCapture}</span>
        </button>
      </div>
    </div>
  );
};
