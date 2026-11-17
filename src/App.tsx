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
  buildClipFilename,
  createCanvasSafePipeline,
  createResilientMediaRecorder,
  getBestLowLagCodec,
  getInitialSettings,
  getResolutionConstraints,
  isDirectoryPickerSupported,
  isDisplayCaptureBlockedByPolicy,
  isDisplayMediaSupported,
  isRunningInIframe,
  isWebShareFilesSupported,
  measureFramePacing,
  probeSupportedCodecs,
  triggerBrowserDownload,
  waitForVideoFrameReady,
} from './utils/captureEngine';
import {
  appendChunkToDB,
  assembleChunksFromDB,
  clearSessionChunksFromDB,
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
  const directoryPickerSupported = useMemo(() => isDirectoryPickerSupported(), []);
  const canShareFiles = useMemo(() => isWebShareFilesSupported(), []);
  const initialIframeBlocked = useMemo(
    () => isRunningInIframe() && isDisplayCaptureBlockedByPolicy(),
    []
  );

  const [settings, setSettings] = useState<CaptureSettings>(() =>
    getInitialSettings(supportedCodecs)
  );

  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [selectedFolderName, setSelectedFolderName] = useState<string | null>(null);
  const [isIframeBlocked, setIsIframeBlocked] = useState(initialIframeBlocked);
  const [hasSystemAudioLive, setHasSystemAudioLive] = useState(false);
  const [hasMicAudioLive, setHasMicAudioLive] = useState(false);

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [isMicMutedLive, setIsMicMutedLive] = useState(false);

  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const [clips, setClips] = useState<RecordedClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [latestClipId, setLatestClipId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FramePacingMetrics | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);

  // Refs for active media pipeline
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const canvasCleanupRef = useRef<(() => void) | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const chunkSeqRef = useRef<number>(0);
  const chunkWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const usingIdbStreamingRef = useRef<boolean>(true);
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

    if (canvasCleanupRef.current) {
      canvasCleanupRef.current();
      canvasCleanupRef.current = null;
    }

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
    setHasSystemAudioLive(false);
    setHasMicAudioLive(false);
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
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
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
    const sessionId = sessionIdRef.current;
    const usedIdb = usingIdbStreamingRef.current;
    const meta = captureMetaRef.current;

    const totalMs =
      Date.now() - recordingStartMsRef.current - pausedAccumulatedMsRef.current;
    const durationSec = Math.max(1, Math.round(totalMs / 1000));
    const mimeType = recorder?.mimeType || meta.mimeType || 'video/webm';

    // Wait for any in-flight 2s chunk writes to IndexedDB before assembling
    await chunkWriteQueueRef.current.catch(() => {});

    let blob: Blob | null = null;
    if (usedIdb && sessionId) {
      try {
        blob = await assembleChunksFromDB(sessionId, mimeType);
      } catch {
        blob = null;
      }
    }
    if (!blob && chunksRef.current.length > 0) {
      blob = new Blob(chunksRef.current, { type: mimeType });
    }
    if (sessionId) {
      void clearSessionChunksFromDB(sessionId).catch(() => {});
    }

    chunksRef.current = [];
    sessionIdRef.current = null;

    cleanupStreams();
    setCaptureState('idle');
    setElapsedSeconds(0);

    if (!blob || blob.size === 0) return;

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
      setLatestClipId(savedClip.id);
      setActiveClipId(savedClip.id);
    } catch {
      // Fallback in-memory URL if IndexedDB quota is exceeded
      const fallbackClip: RecordedClip = {
        ...clipRecord,
        blobUrl: URL.createObjectURL(blob),
      };
      setClips((prev) => [fallbackClip, ...prev]);
      setLatestClipId(fallbackClip.id);
      setActiveClipId(fallbackClip.id);
    }

    // Save automatically to device storage (chosen folder or browser Downloads)
    const filename = buildClipFilename(clipRecord.name, mimeType);
    if (settings.autoSaveToDevice) {
      let savedToFolder = false;
      if (directoryHandleRef.current) {
        try {
          const fileHandle = await directoryHandleRef.current.getFileHandle(filename, {
            create: true,
          });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          savedToFolder = true;
          setSaveNotice(`Saved "${filename}" directly to folder "${directoryHandleRef.current.name}".`);
        } catch {
          savedToFolder = false;
        }
      }

      if (!savedToFolder) {
        triggerBrowserDownload(blob, filename);
        setSaveNotice(`Saved "${filename}" to your device Downloads folder and Clips Library.`);
      }
    } else {
      setSaveNotice(`Saved "${clipRecord.name}" to Clips Library.`);
    }
  }, [cleanupStreams, settings.autoSaveToDevice]);

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
    (
      streamToRecord: MediaStream,
      hasMic: boolean,
      hasSystemAudio: boolean,
      detectedWidth: number,
      detectedHeight: number
    ) => {
      const videoTrack = streamToRecord.getVideoTracks()[0];
      const trackSettings = videoTrack?.getSettings();

      const recorder = createResilientMediaRecorder(
        streamToRecord,
        settings.mimeType,
        settings.videoBitrateMbps * 1_000_000
      );
      mediaRecorderRef.current = recorder;

      const sessionId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      sessionIdRef.current = sessionId;
      chunkSeqRef.current = 0;
      chunkWriteQueueRef.current = Promise.resolve();
      usingIdbStreamingRef.current = true;
      chunksRef.current = [];

      captureMetaRef.current = {
        width: detectedWidth || trackSettings?.width || 0,
        height: detectedHeight || trackSettings?.height || 0,
        fps: Math.round(trackSettings?.frameRate ?? settings.fps),
        mimeType: recorder.mimeType || settings.mimeType || 'video/webm',
        hasMic,
        hasSystemAudio,
      };

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          const chunk = ev.data;
          if (usingIdbStreamingRef.current && sessionIdRef.current) {
            const seq = chunkSeqRef.current++;
            const sid = sessionIdRef.current;
            chunkWriteQueueRef.current = chunkWriteQueueRef.current
              .then(() => appendChunkToDB(sid, seq, chunk))
              .catch(() => {
                // Fall back to memory array if IndexedDB fails mid-session
                usingIdbStreamingRef.current = false;
                chunksRef.current.push(chunk);
              });
          } else {
            chunksRef.current.push(chunk);
          }
        }
      };

      recorder.onstop = () => {
        void finalizeRecording();
      };

      // Flush chunks every 2 seconds to IndexedDB so unlimited-duration recording keeps RAM flat
      recorder.start(2000);
      recordingStartMsRef.current = Date.now();
      pausedAccumulatedMsRef.current = 0;
      setElapsedSeconds(0);
      setCaptureState('recording');

      timerIntervalRef.current = window.setInterval(() => {
        const ms = Date.now() - recordingStartMsRef.current - pausedAccumulatedMsRef.current;
        setElapsedSeconds(Math.max(0, Math.floor(ms / 1000)));
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

      const attemptStartedAt = performance.now();
      try {
        let displayStream: MediaStream | null = null;
        if (!micOnly) {
          const resConstraints = getResolutionConstraints(settings.resolution);
          const displayOptions = {
            video: {
              ...resConstraints,
              frameRate: { ideal: settings.fps },
            },
            audio: settings.systemAudioEnabled
              ? {
                  echoCancellation: false,
                  noiseSuppression: false,
                  autoGainControl: false,
                }
              : false,
            systemAudio: 'include',
            surfaceSwitching: 'include',
            monitorTypeSurfaces: 'include',
          } as DisplayMediaStreamOptions;
          displayStream = await navigator.mediaDevices.getDisplayMedia(displayOptions);
          displayStreamRef.current = displayStream;
          setIsIframeBlocked(false);
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
        setHasSystemAudioLive(hasDisplayAudio);
        setHasMicAudioLive(hasMicAudio);

        if (!micOnly && settings.systemAudioEnabled && !hasDisplayAudio) {
          setErrorMessage(
            'Screen is recording, but no game/system audio was shared. Next time, turn on "Share system audio" (or "Share tab audio") in the browser picker.'
          );
        }

        const outputTracks: MediaStreamTrack[] = [];
        let readySize = { width: 0, height: 0 };

        if (displayStream) {
          // Wait until the display stream delivers a real decoded frame (prevents black/0x0 recordings)
          readySize = await waitForVideoFrameReady(displayStream);

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
          });

          if (settings.safeCanvasCapture) {
            const safePipeline = createCanvasSafePipeline(
              displayStream,
              settings.fps,
              readySize.width,
              readySize.height
            );
            canvasCleanupRef.current = safePipeline.cleanup;
            if (safePipeline.track) {
              outputTracks.push(safePipeline.track);
            }
          } else {
            displayStream.getVideoTracks().forEach((track) => outputTracks.push(track));
          }
        }

        if (hasDisplayAudio || hasMicAudio) {
          const ctx = new AudioContext({ latencyHint: 'playback' });
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
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
        // Preview the raw displayStream directly so live monitor shows the screen immediately
        setPreviewStream(displayStream ?? combined);

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
              beginMediaRecorder(
                combined,
                hasMicAudio,
                hasDisplayAudio,
                readySize.width,
                readySize.height
              );
            } else {
              setCountdownRemaining(remaining);
            }
          }, 1000);
        } else {
          beginMediaRecorder(
            combined,
            hasMicAudio,
            hasDisplayAudio,
            readySize.width,
            readySize.height
          );
        }
      } catch (err) {
        const rejectionMs = performance.now() - attemptStartedAt;
        cleanupStreams();
        setCaptureState('idle');
        const msg = err instanceof Error ? err.message : '';
        const policyBlocked =
          isDisplayCaptureBlockedByPolicy() ||
          /permissions?\s*policy|disallowed|feature/i.test(msg) ||
          (!micOnly && isRunningInIframe() && rejectionMs < 200);

        if (err instanceof Error && err.message === 'mic-denied') {
          setErrorMessage('Microphone permission was denied.');
        } else if (policyBlocked) {
          setIsIframeBlocked(true);
          setErrorMessage(
            'Screen recording is blocked inside this embedded preview frame. Click "Open in New Tab" on the right to record your screen and game audio.'
          );
        } else if (err instanceof DOMException && err.name === 'NotAllowedError') {
          setErrorMessage('Screen selection was canceled or permission was denied.');
        } else {
          setErrorMessage(
            msg ? `Could not start recording: ${msg}` : 'Could not start screen capture. Please verify browser permissions.'
          );
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
        const ms = Date.now() - recordingStartMsRef.current - pausedAccumulatedMsRef.current;
        setElapsedSeconds(Math.max(0, Math.floor(ms / 1000)));
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

  const handleChooseFolder = useCallback(async () => {
    try {
      const picker = (
        window as unknown as {
          showDirectoryPicker?: (opts?: { mode?: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
        }
      ).showDirectoryPicker;
      if (!picker) return;
      const handle = await picker({ mode: 'readwrite' });
      directoryHandleRef.current = handle;
      setSelectedFolderName(handle.name);
      setSettings((prev) => ({ ...prev, autoSaveToDevice: true }));
    } catch {
      // User canceled folder picker
    }
  }, []);

  const handleDownloadClip = useCallback(async (clip: RecordedClip) => {
    const filename = buildClipFilename(clip.name, clip.mimeType);
    const blob = await getClipBlobFromDB(clip.id);
    if (blob) {
      triggerBrowserDownload(blob, filename);
      setSaveNotice(`Downloaded "${filename}" to your device storage.`);
      return;
    }

    if (clip.blobUrl) {
      const a = document.createElement('a');
      a.href = clip.blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, []);

  const handleShareClip = useCallback(async (clip: RecordedClip) => {
    const filename = buildClipFilename(clip.name, clip.mimeType);
    let blob = await getClipBlobFromDB(clip.id);
    if (!blob && clip.blobUrl) {
      const res = await fetch(clip.blobUrl);
      blob = await res.blob();
    }
    if (!blob) return;

    const file = new File([blob], filename, { type: clip.mimeType || 'video/webm' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: clip.name,
        });
      } catch {
        // User canceled share sheet
      }
    } else {
      triggerBrowserDownload(blob, filename);
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
          isIframeBlocked={isIframeBlocked}
          hasSystemAudioLive={hasSystemAudioLive}
          hasMicAudioLive={hasMicAudioLive}
          errorMessage={errorMessage}
          saveNotice={saveNotice}
          latestClipId={latestClipId}
          onDismissSaveNotice={() => setSaveNotice(null)}
          onWatchLatestClip={(id) => {
            setActiveClipId(id);
            document.getElementById('clips')?.scrollIntoView({ behavior: 'smooth' });
          }}
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
          directoryPickerSupported={directoryPickerSupported}
          selectedFolderName={selectedFolderName}
          onSelectPreset={handleSelectPreset}
          onUpdateSettings={handleUpdateSettings}
          onToggleMicTest={() => void handleToggleMicTest()}
          onChooseFolder={() => void handleChooseFolder()}
        />

        <ClipsLibrary
          t={t.clips}
          clips={clips}
          activeClipId={activeClipId}
          onSelectClipId={setActiveClipId}
          canShareFiles={canShareFiles}
          onStartFirstRecording={handlePrimaryHeaderAction}
          onDownloadClip={(clip) => void handleDownloadClip(clip)}
          onShareClip={(clip) => void handleShareClip(clip)}
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
