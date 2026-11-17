import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Mic,
  MicOff,
  Monitor,
  Pause,
  Play,
  Square,
  AlertTriangle,
} from 'lucide-react';
import type { CaptureSettings, CaptureState } from '../types/recorder';
import type { Translations } from '../i18n/translations';
import { formatDuration, getFileExtensionForMime } from '../utils/captureEngine';

interface CaptureStageProps {
  t: Translations['hero'];
  captureState: CaptureState;
  countdownRemaining: number;
  elapsedSeconds: number;
  settings: CaptureSettings;
  previewStream: MediaStream | null;
  micLevel: number; // 0 - 100
  isMicMutedLive: boolean;
  displayMediaSupported: boolean;
  errorMessage: string | null;
  onStartScreenCapture: () => void;
  onStartMicOnlyCapture: () => void;
  onCancelCountdown: () => void;
  onPauseResume: () => void;
  onStopCapture: () => void;
  onToggleLiveMicMute: () => void;
  onToggleEcoPreview: () => void;
}

export const CaptureStage: React.FC<CaptureStageProps> = ({
  t,
  captureState,
  countdownRemaining,
  elapsedSeconds,
  settings,
  previewStream,
  micLevel,
  isMicMutedLive,
  displayMediaSupported,
  errorMessage,
  onStartScreenCapture,
  onStartMicOnlyCapture,
  onCancelCountdown,
  onPauseResume,
  onStopCapture,
  onToggleLiveMicMute,
  onToggleEcoPreview,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [forceShowPreview, setForceShowPreview] = useState(false);

  const isRecordingOrPaused = captureState === 'recording' || captureState === 'paused';
  const showLiveVideo =
    isRecordingOrPaused &&
    previewStream !== null &&
    previewStream.getVideoTracks().length > 0 &&
    (!settings.ecoPreviewDuringRec || forceShowPreview);

  useEffect(() => {
    if (!isRecordingOrPaused) {
      setForceShowPreview(false);
    }
  }, [isRecordingOrPaused]);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (showLiveVideo && previewStream) {
      videoEl.srcObject = previewStream;
    } else {
      videoEl.srcObject = null;
    }
  }, [showLiveVideo, previewStream]);

  const codecExt = getFileExtensionForMime(settings.mimeType).toUpperCase();
  const resLabel = settings.resolution === 'native' ? 'Native' : settings.resolution;

  return (
    <section id="studio" className="space-y-6">
      <div className="max-w-3xl space-y-3">
        <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12] [text-wrap:balance]">
          {t.title}
        </h1>
        <p className="text-base leading-relaxed text-slate-300 max-w-[68ch]">{t.subtitle}</p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-200"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Primary 16:9 Studio Capture Viewport */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#13161D]">
        <div className="relative aspect-video w-full bg-[#090B0E] flex flex-col items-center justify-center p-6 sm:p-10">
          {/* Live Video Element when preview is active */}
          {showLiveVideo && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-contain bg-black"
            />
          )}

          {/* Idle State */}
          {captureState === 'idle' && (
            <div className="relative z-10 flex max-w-xl flex-col items-center text-center space-y-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#181C24] text-rose-400">
                <Monitor className="h-7 w-7" />
              </div>

              {displayMediaSupported ? (
                <>
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-medium text-slate-400 font-mono">
                      <span>{resLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{settings.fps} FPS</span>
                      <span aria-hidden="true">·</span>
                      <span>{settings.videoBitrateMbps} Mbps</span>
                      <span aria-hidden="true">·</span>
                      <span>{codecExt}</span>
                      <span aria-hidden="true">·</span>
                      <span>{settings.micEnabled ? 'Mic ON' : 'Mic OFF'}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onStartScreenCapture}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2.5 rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-500 active:scale-[0.98] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    <Monitor className="h-4 w-4" />
                    <span>{t.selectScreenBtn}</span>
                  </button>
                </>
              ) : (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold text-white">
                    {t.unsupportedTitle}
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">{t.unsupportedBody}</p>
                  <button
                    type="button"
                    onClick={onStartMicOnlyCapture}
                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-500 whitespace-nowrap"
                  >
                    <Mic className="h-4 w-4" />
                    <span>{t.recordMicOnlyFallback}</span>
                  </button>
                </div>
              )}

              {/* Real Live Mic Meter Preview (when testing mic or active) */}
              <div className="w-full max-w-xs space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    {settings.micEnabled ? (
                      <Mic className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <MicOff className="h-3.5 w-3.5 text-slate-500" />
                    )}
                    <span>{settings.micEnabled ? 'Mic Ready' : 'Mic Disabled'}</span>
                  </span>
                  <span className="font-mono">{Math.round(micLevel)}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full bg-emerald-500 transition-[width] duration-75"
                    style={{ width: `${Math.min(100, Math.max(0, micLevel))}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Countdown Overlay */}
          {captureState === 'countdown' && (
            <div className="relative z-10 flex flex-col items-center space-y-5 text-center">
              <p className="text-sm font-medium text-slate-300">{t.startingIn}</p>
              <div className="font-display text-7xl font-bold text-white font-mono">
                {countdownRemaining}
              </div>
              <button
                type="button"
                onClick={onCancelCountdown}
                className="min-h-[44px] rounded-lg border border-white/15 bg-white/5 px-5 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          )}

          {/* Recording / Paused Eco Mode Overlay (Zero-Blit) */}
          {isRecordingOrPaused && !showLiveVideo && (
            <div className="relative z-10 flex max-w-lg flex-col items-center text-center space-y-5">
              <div className="flex items-center gap-3">
                {captureState === 'recording' ? (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-rose-400">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
                    {t.recordingBadge}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-amber-400">
                    <Pause className="h-3.5 w-3.5" />
                    {t.pausedBadge}
                  </span>
                )}
                <span className="text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-mono text-2xl font-semibold text-white">
                  {formatDuration(elapsedSeconds)}
                </span>
              </div>

              <div className="space-y-1.5">
                <h2 className="font-display text-lg font-semibold text-white">
                  {previewStream && previewStream.getVideoTracks().length > 0
                    ? t.ecoBannerTitle
                    : 'Microphone Capture Active'}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">{t.ecoBannerBody}</p>
              </div>

              {/* Real live mic meter during recording */}
              <div className="w-full max-w-xs space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{isMicMutedLive ? 'Mic Muted' : 'Mic Input'}</span>
                  <span className="font-mono">{isMicMutedLive ? '0%' : `${Math.round(micLevel)}%`}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className={`h-full transition-[width] duration-75 ${
                      isMicMutedLive ? 'bg-slate-600' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${isMicMutedLive ? 0 : Math.min(100, micLevel)}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Scrim + Top-Left Live HUD when Video Preview IS visible */}
          {isRecordingOrPaused && showLiveVideo && (
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 py-3">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-white">
                {captureState === 'recording' ? (
                  <span className="inline-flex items-center gap-1.5 text-rose-400">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    {t.recordingBadge}
                  </span>
                ) : (
                  <span className="text-amber-400">{t.pausedBadge}</span>
                )}
                <span aria-hidden="true" className="text-white/40">
                  ·
                </span>
                <span className="font-mono text-sm">{formatDuration(elapsedSeconds)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Studio Transport Bar below stage */}
        {isRecordingOrPaused && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-[#181C24] px-4 py-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onPauseResume}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                {captureState === 'paused' ? (
                  <>
                    <Play className="h-4 w-4" />
                    <span>{t.resume}</span>
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4" />
                    <span>{t.pause}</span>
                  </>
                )}
              </button>

              {settings.micEnabled && (
                <button
                  type="button"
                  onClick={onToggleLiveMicMute}
                  className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isMicMutedLive
                      ? 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                      : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                  }`}
                >
                  {isMicMutedLive ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span>{t.unmuteMic}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      <span>{t.muteMic}</span>
                    </>
                  )}
                </button>
              )}

              {previewStream && previewStream.getVideoTracks().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (settings.ecoPreviewDuringRec) {
                      setForceShowPreview((prev) => !prev);
                    } else {
                      onToggleEcoPreview();
                    }
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  {showLiveVideo ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      <span>{t.hidePreview}</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      <span>{t.showPreview}</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onStopCapture}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition-colors whitespace-nowrap"
            >
              <Square className="h-4 w-4 fill-current" />
              <span>{t.stopSave}</span>
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
