import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EN_COPY } from './i18n/translations';
import type {
  CaptureSettings,
  CaptureState,
  FramePacingMetrics,
  PresetId,
  RecordedClip,
} from './types/recorder';
import {
  applyPresetToSettings,
  getBestLowLagCodec,
  getFileExtensionForMime,
  getInitialSettings,
  getResolutionConstraints,
  isDisplayMediaSupported,
  measureFramePacing,
  probeSupportedCodecs,
} from './utils/captureEngine';
import {
  deleteClipFromDB,
  getAllClipsFromDB,
  getClipBlobFromDB,
  renameClipInDB,
  saveClipToDB,
} from './utils/storage';
import { Header } from './components/Header';
import { CaptureStage } from './components/CaptureStage';
import { PresetAndAudioPanel } from './components/PresetAndAudioPanel';
import { SmoothnessCheckSection } from './components/SmoothnessCheckSection';
import { ClipsLibrary } from './components/ClipsLibrary';
import { MobileBottomBar } from './components/MobileBottomBar';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  const t = EN_COPY;

  const supportedCodecs = useMemo(() => probeSupportedCodecs(), []);
  const recommendedCodecMime = useMemo(
    () => getBestLowLagCodec(supportedCodecs),
    [supportedCodecs]
  );
  const displayMediaSupported = useMemo(() => isDisplayMediaSupported(), []);

  const [settings, setSettings] = useState<CaptureSettings>(() =>
    getInitialSettings(supportedCodecs)
  );

  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isMicMutedLive, setIsMicMutedLive] = useState(false);

  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const [clips, setClips] = useState<RecordedClip[]>([]);
  const [metrics, setMetrics] = useState<FramePacingMetrics | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  // Refs for active media pipeline
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micGainNodeRef = useRef<GainNode | null>(null);
  const systemGainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const meterIntervalRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const recordingStartMsRef = useRef<number>(0);
  const pausedAccumulatedMsRef = useRef<number>(0);
  const pauseStartedMsRef = useRef<number>(0);
  const captureMetaRef = useRef<{
    width: number;
    height: number;
    fps: number;
    mimeType: string;
    hasMic: boolean;
    hasSystemAudio: boolean;
  }>({
    width: 1920,
    height: 1080,
    fps: 60,
    mimeType: 'video/webm',
    hasMic: false,
    hasSystemAudio: false,
  });

  // Load persisted clips from IndexedDB on mount
  useEffect(() => {
    let active = true;
    getAllClipsFromDB()
      .then((loaded) => {
        if (active) setClips(loaded);
      })
      .catch(() => {
        // Ignore storage read errors in restricted private contexts
      });
    return () => {
      active = false;
    };
  }, []);

  // Run an initial passive frame pacing check once on mount
  useEffect(() => {
    let cancelled = false;
    measureFramePacing(1200).then((res) => {
      if (!cancelled) setMetrics(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stopMicMeter = useCallback(() => {
    if (meterIntervalRef.current !== null) {
      window.clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    analyserRef.current = null;
    setMicLevel(0);
  }, []);

  const startMicMeterLoop = useCallback((analyser: AnalyserNode) => {
    stopMicMeter();
    analyserRef.current = analyser;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    // Throttled at ~12Hz so React updates never cause game/UI frame drops
    meterIntervalRef.current = window.setInterval(() => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(dataArray);
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const normalized = (dataArray[i] - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const level = Math.min(100, Math.round(rms * 340));
      setMicLevel(level);
    }, 85);
  }, [stopMicMeter]);

  const cleanupStreams = useCallback(() => {
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    stopMicMeter();

    displayStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    displayStreamRef.current = null;

    micStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    micStreamRef.current = null;

    combinedStreamRef.current?.getTracks().forEach((tr) => tr.stop());
    combinedStreamRef.current = null;

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    micGainNodeRef.current = null;
    systemGainNodeRef.current = null;
    mediaRecorderRef.current = null;
    setPreviewStream(null);
    setIsTestingMic(false);
    setIsMicMutedLive(false);
  }, [stopMicMeter]);

  useEffect(() => {
    return () => {
      cleanupStreams();
    };
  }, [cleanupStreams]);

  // Live gain updates during recording
  useEffect(() => {
    if (micGainNodeRef.current) {
      micGainNodeRef.current.gain.value = isMicMutedLive ? 0 : settings.micGain;
    }
  }, [settings.micGain, isMicMutedLive]);

  useEffect(() => {
    if (systemGainNodeRef.current) {
      systemGainNodeRef.current.gain.value = settings.systemGain;
    }
  }, [settings.systemGain]);

  const stopMicTest = useCallback(() => {
    if (!isTestingMic) return;
    cleanupStreams();
  }, [isTestingMic, cleanupStreams]);

  const handleToggleMicTest = useCallback(async () => {
    setErrorMessage(null);
    if (isTestingMic) {
      stopMicTest();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
          sampleRate: 48000,
        },
      });
      micStreamRef.current = stream;
      const ctx = new AudioContext({ latencyHint: 'playback' });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = settings.micGain;
      micGainNodeRef.current = gain;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(gain);
      gain.connect(analyser);
      setIsTestingMic(true);
      startMicMeterLoop(analyser);
    } catch {
      setErrorMessage(
        'Microphone permission was denied. Please allow microphone access in your browser.'
      );
    }
  }, [
    isTestingMic,
    stopMicTest,
    settings.echoCancellation,
    settings.noiseSuppression,
    settings.autoGainControl,
    settings.micGain,
    startMicMeterLoop,
  ]);

  const finalizeRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    const chunks = chunksRef.current;
    const meta = captureMetaRef.current;

    const totalMs =
      Date.now() - recordingStartMsRef.current - pausedAccumulatedMsRef.current;
    const durationSec = Math.max(1, Math.round(totalMs / 1000));

    const mimeType = recorder?.mimeType || meta.mimeType || 'video/webm';
    const blob = new Blob(chunks, { type: mimeType });
    chunksRef.current = [];

    cleanupStreams();
    setCaptureState('idle');
    setElapsedSeconds(0);

    if (blob.size === 0) return;

    const now = new Date();
    const stamp = `${now.getHours().toString().padStart(2, '0')}-${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
    const clipRecord: Omit<RecordedClip, 'blobUrl'> = {
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: `Capture ${now.toLocaleDateString()} ${stamp}`,
      createdAt: Date.now(),
      durationSec,
      sizeBytes: blob.size,
      width: meta.width,
      height: meta.height,
      fps: meta.fps,
      mimeType,
      hasMic: meta.hasMic,
      hasSystemAudio: meta.hasSystemAudio,
    };

    try {
      const savedClip = await saveClipToDB(clipRecord, blob);
      setClips((prev) => [savedClip, ...prev]);
    } catch {
      // Fallback in-memory URL if IndexedDB quota is exceeded
      const fallbackClip: RecordedClip = {
        ...clipRecord,
        blobUrl: URL.createObjectURL(blob),
      };
      setClips((prev) => [fallbackClip, ...prev]);
    }
  }, [cleanupStreams]);

  const stopCapture = useCallback(() => {
    if (captureState === 'countdown') {
      cleanupStreams();
      setCaptureState('idle');
      setCountdownRemaining(0);
      return;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      cleanupStreams();
      setCaptureState('idle');
      setElapsedSeconds(0);
    }
  }, [captureState, cleanupStreams]);

  const beginMediaRecorder = useCallback(
    (streamToRecord: MediaStream, hasMic: boolean, hasSystemAudio: boolean) => {
      const videoTrack = streamToRecord.getVideoTracks()[0];
      const trackSettings = videoTrack?.getSettings();
      const chosenMime =
        settings.mimeType && MediaRecorder.isTypeSupported(settings.mimeType)
          ? settings.mimeType
          : '';

      captureMetaRef.current = {
        width: trackSettings?.width ?? 0,
        height: trackSettings?.height ?? 0,
        fps: Math.round(trackSettings?.frameRate ?? settings.fps),
        mimeType: chosenMime || 'video/webm',
        hasMic,
        hasSystemAudio,
      };

      const recorderOptions: MediaRecorderOptions = {
        videoBitsPerSecond: settings.videoBitrateMbps * 1_000_000,
        audioBitsPerSecond: 128_000,
      };
      if (chosenMime) {
        recorderOptions.mimeType = chosenMime;
      }

      const recorder = new MediaRecorder(streamToRecord, recorderOptions);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = () => {
        void finalizeRecording();
      };

      // Flush chunks every 2 seconds to prevent RAM spikes and game micro-stutters
      recorder.start(2000);
      recordingStartMsRef.current = Date.now();
      pausedAccumulatedMsRef.current = 0;
      setElapsedSeconds(0);
      setCaptureState('recording');

      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    },
    [settings.fps, settings.mimeType, settings.videoBitrateMbps, finalizeRecording]
  );

  const startCapturePipeline = useCallback(
    async (micOnly: boolean) => {
      setErrorMessage(null);
      if (isTestingMic) {
        stopMicTest();
      }

      try {
        let displayStream: MediaStream | null = null;
        if (!micOnly) {
          const resConstraints = getResolutionConstraints(settings.resolution);
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              ...resConstraints,
              frameRate: { ideal: settings.fps, max: settings.fps },
            },
            audio: settings.systemAudioEnabled,
          });
          displayStreamRef.current = displayStream;
        }

        let micStream: MediaStream | null = null;
        if (settings.micEnabled || micOnly) {
          try {
            micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: settings.echoCancellation,
                noiseSuppression: settings.noiseSuppression,
                autoGainControl: settings.autoGainControl,
                channelCount: 1,
                sampleRate: 48000,
              },
            });
            micStreamRef.current = micStream;
          } catch {
            if (micOnly) {
              throw new Error('mic-denied');
            }
            // Non-blocking fallback: continue recording screen even if mic was denied
            setErrorMessage(
              'Microphone permission denied — recording screen without microphone.'
            );
          }
        }

        // Build mixed audio track via playback-latency Web Audio graph
        const hasDisplayAudio = (displayStream?.getAudioTracks().length ?? 0) > 0;
        const hasMicAudio = (micStream?.getAudioTracks().length ?? 0) > 0;
        const outputTracks: MediaStreamTrack[] = [];

        if (displayStream) {
          displayStream.getVideoTracks().forEach((track) => {
            track.onended = () => {
              const rec = mediaRecorderRef.current;
              if (rec && rec.state !== 'inactive') {
                rec.stop();
              } else {
                cleanupStreams();
                setCaptureState('idle');
              }
            };
            outputTracks.push(track);
          });
        }

        if (hasDisplayAudio || hasMicAudio) {
          const ctx = new AudioContext({ latencyHint: 'playback' });
          audioCtxRef.current = ctx;
          const dest = ctx.createMediaStreamDestination();

          if (hasDisplayAudio && displayStream) {
            const sysSource = ctx.createMediaStreamSource(
              new MediaStream(displayStream.getAudioTracks())
            );
            const sysGain = ctx.createGain();
            sysGain.gain.value = settings.systemGain;
            systemGainNodeRef.current = sysGain;
            sysSource.connect(sysGain);
            sysGain.connect(dest);
          }

          if (hasMicAudio && micStream) {
            const micSource = ctx.createMediaStreamSource(micStream);
            const micGain = ctx.createGain();
            micGain.gain.value = settings.micGain;
            micGainNodeRef.current = micGain;

            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;

            micSource.connect(micGain);
            micGain.connect(dest);
            micGain.connect(analyser);
            startMicMeterLoop(analyser);
          }

          dest.stream.getAudioTracks().forEach((tr) => outputTracks.push(tr));
        }

        const combined = new MediaStream(outputTracks);
        combinedStreamRef.current = combined;
        setPreviewStream(combined);

        if (settings.countdownSec > 0 && !micOnly) {
          let remaining: number = settings.countdownSec;
          setCountdownRemaining(remaining);
          setCaptureState('countdown');

          countdownIntervalRef.current = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
              if (countdownIntervalRef.current !== null) {
                window.clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              beginMediaRecorder(combined, hasMicAudio, hasDisplayAudio);
            } else {
              setCountdownRemaining(remaining);
            }
          }, 1000);
        } else {
          beginMediaRecorder(combined, hasMicAudio, hasDisplayAudio);
        }
      } catch (err) {
        cleanupStreams();
        setCaptureState('idle');
        if (err instanceof Error && err.message === 'mic-denied') {
          setErrorMessage('Microphone permission was denied.');
        } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
          // User closed the screen picker voluntarily; keep message subtle
          setErrorMessage(null);
        } else {
          setErrorMessage('Could not start screen capture. Please verify browser permissions.');
        }
      }
    },
    [
      isTestingMic,
      stopMicTest,
      settings,
      cleanupStreams,
      startMicMeterLoop,
      beginMediaRecorder,
    ]
  );

  const handlePauseResume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'recording') {
      recorder.pause();
      pauseStartedMsRef.current = Date.now();
      if (timerIntervalRef.current !== null) {
        window.clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setCaptureState('paused');
    } else if (recorder.state === 'paused') {
      recorder.resume();
      pausedAccumulatedMsRef.current += Date.now() - pauseStartedMsRef.current;
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
      setCaptureState('recording');
    }
  }, []);

  const handleToggleLiveMicMute = useCallback(() => {
    setIsMicMutedLive((prev) => {
      const next = !prev;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((tr) => {
          tr.enabled = !next;
        });
      }
      return next;
    });
  }, []);

  const handlePrimaryHeaderAction = useCallback(() => {
    if (captureState === 'idle') {
      if (displayMediaSupported) {
        void startCapturePipeline(false);
      } else {
        void startCapturePipeline(true);
      }
    } else {
      stopCapture();
    }
  }, [captureState, displayMediaSupported, startCapturePipeline, stopCapture]);

  const handleSelectPreset = useCallback(
    (presetId: PresetId) => {
      setSettings((prev) => applyPresetToSettings(prev, presetId, supportedCodecs));
    },
    [supportedCodecs]
  );

  const handleUpdateSettings = useCallback((patch: Partial<CaptureSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleRunBenchmark = useCallback(async () => {
    setIsMeasuring(true);
    const result = await measureFramePacing(2000);
    setMetrics(result);
    setIsMeasuring(false);
  }, []);

  const handleDownloadClip = useCallback(async (clip: RecordedClip) => {
    const ext = getFileExtensionForMime(clip.mimeType);
    const safeName = clip.name.replace(/[^a-zA-Z0-9_-]+/g, '_');
    let href = clip.blobUrl;
    let shouldRevoke = false;

    if (!href) {
      const blob = await getClipBlobFromDB(clip.id);
      if (!blob) return;
      href = URL.createObjectURL(blob);
      shouldRevoke = true;
    }

    const a = document.createElement('a');
    a.href = href;
    a.download = `${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (shouldRevoke) {
      URL.revokeObjectURL(href);
    }
  }, []);

  const handleDeleteClip = useCallback(async (id: string) => {
    setClips((prev) => {
      const target = prev.find((c) => c.id === id);
      if (target?.blobUrl) {
        URL.revokeObjectURL(target.blobUrl);
      }
      return prev.filter((c) => c.id !== id);
    });
    try {
      await deleteClipFromDB(id);
    } catch {
      // Ignore DB deletion errors
    }
  }, []);

  const handleRenameClip = useCallback(async (id: string, newName: string) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
    try {
      await renameClipInDB(id, newName);
    } catch {
      // Ignore DB rename errors
    }
  }, []);

  const isBusy = captureState !== 'idle';

  return (
    <div className="min-h-screen bg-[#0B0D11] text-slate-100">
      <Header
        t={t.nav}
        captureState={captureState}
        onPrimaryAction={handlePrimaryHeaderAction}
      />

      <main className="mx-auto max-w-7xl px-4 pt-8 pb-24 sm:px-6 lg:px-8 space-y-16">
        <div className="flex items-center justify-end empty:hidden">
          <PWAInstallButton />
        </div>

        <CaptureStage
          t={t.hero}
          captureState={captureState}
          countdownRemaining={countdownRemaining}
          elapsedSeconds={elapsedSeconds}
          settings={settings}
          previewStream={previewStream}
          micLevel={micLevel}
          isMicMutedLive={isMicMutedLive}
          displayMediaSupported={displayMediaSupported}
          errorMessage={errorMessage}
          onStartScreenCapture={() => void startCapturePipeline(false)}
          onStartMicOnlyCapture={() => void startCapturePipeline(true)}
          onCancelCountdown={stopCapture}
          onPauseResume={handlePauseResume}
          onStopCapture={stopCapture}
          onToggleLiveMicMute={handleToggleLiveMicMute}
          onToggleEcoPreview={() =>
            handleUpdateSettings({ ecoPreviewDuringRec: !settings.ecoPreviewDuringRec })
          }
        />

        <PresetAndAudioPanel
          presetsT={t.presets}
          audioT={t.audio}
          settings={settings}
          supportedCodecs={supportedCodecs}
          disabled={isBusy}
          isTestingMic={isTestingMic}
          micLevel={micLevel}
          onSelectPreset={handleSelectPreset}
          onUpdateSettings={handleUpdateSettings}
          onToggleMicTest={() => void handleToggleMicTest()}
        />

        <ClipsLibrary
          t={t.clips}
          clips={clips}
          onStartFirstRecording={handlePrimaryHeaderAction}
          onDownloadClip={(clip) => void handleDownloadClip(clip)}
          onDeleteClip={(id) => void handleDeleteClip(id)}
          onRenameClip={(id, name) => void handleRenameClip(id, name)}
        />

        <SmoothnessCheckSection
          t={t.smoothness}
          codecs={supportedCodecs}
          recommendedCodecMime={recommendedCodecMime}
          metrics={metrics}
          isMeasuring={isMeasuring}
          onRunBenchmark={() => void handleRunBenchmark()}
        />
      </main>

      <MobileBottomBar
        t={t.hero}
        navT={t.nav}
        captureState={captureState}
        elapsedSeconds={elapsedSeconds}
        micEnabled={settings.micEnabled}
        isMicMutedLive={isMicMutedLive}
        onPrimaryAction={handlePrimaryHeaderAction}
        onToggleMic={() => {
          if (isBusy) {
            handleToggleLiveMicMute();
          } else {
            handleUpdateSettings({ micEnabled: !settings.micEnabled });
          }
        }}
      />
      <OfflineIndicator />
    </div>
  );
}
