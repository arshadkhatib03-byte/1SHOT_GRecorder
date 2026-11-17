import type {
  CaptureSettings,
  CodecSupportInfo,
  FramePacingMetrics,
  PresetId,
  ResolutionOption,
} from '../types/recorder';

const CANDIDATE_CODECS: Array<Omit<CodecSupportInfo, 'supported'>> = [
  {
    mimeType: 'video/webm;codecs=vp8,opus',
    label: 'VP8 + Opus (WebM)',
    container: 'webm',
    cpuProfile: 'Low CPU (Hardware)',
  },
  {
    mimeType: 'video/webm;codecs=h264,opus',
    label: 'H.264 + Opus (WebM)',
    container: 'webm',
    cpuProfile: 'Low CPU (Hardware)',
  },
  {
    mimeType: 'video/webm;codecs=vp9,opus',
    label: 'VP9 + Opus (WebM)',
    container: 'webm',
    cpuProfile: 'High Detail',
  },
  {
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    label: 'H.264 + AAC (MP4)',
    container: 'mp4',
    cpuProfile: 'Low CPU (Hardware)',
  },
  {
    mimeType: 'video/webm;codecs=av01.0.08M.08,opus',
    label: 'AV1 + Opus (WebM)',
    container: 'webm',
    cpuProfile: 'Balanced',
  },
  {
    mimeType: 'video/webm',
    label: 'Standard WebM',
    container: 'webm',
    cpuProfile: 'Balanced',
  },
];

export function probeSupportedCodecs(): CodecSupportInfo[] {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return CANDIDATE_CODECS.map((c) => ({ ...c, supported: false }));
  }

  return CANDIDATE_CODECS.map((codec) => ({
    ...codec,
    supported: MediaRecorder.isTypeSupported(codec.mimeType),
  }));
}

export function getBestLowLagCodec(codecs: CodecSupportInfo[]): string {
  const supported = codecs.filter((c) => c.supported);
  if (supported.length === 0) return '';
  // Prefer VP8+Opus WebM first for guaranteed video frame decoding and low-CPU capture
  const preferredOrder = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  ];
  for (const mime of preferredOrder) {
    const match = supported.find((c) => c.mimeType === mime);
    if (match) return match.mimeType;
  }
  return supported[0].mimeType;
}

export function getBestQualityCodec(codecs: CodecSupportInfo[]): string {
  const supported = codecs.filter((c) => c.supported);
  if (supported.length === 0) return '';
  const preferredOrder = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp8,opus',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm',
  ];
  for (const mime of preferredOrder) {
    const match = supported.find((c) => c.mimeType === mime);
    if (match) return match.mimeType;
  }
  return supported[0].mimeType;
}

export function isDisplayMediaSupported(): boolean {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === 'function'
  );
}

export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

export function isDisplayCaptureBlockedByPolicy(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & {
    featurePolicy?: { allowsFeature?: (name: string) => boolean };
    permissionsPolicy?: { allowsFeature?: (name: string) => boolean };
  };
  try {
    if (doc.featurePolicy && typeof doc.featurePolicy.allowsFeature === 'function') {
      return !doc.featurePolicy.allowsFeature('display-capture');
    }
    if (doc.permissionsPolicy && typeof doc.permissionsPolicy.allowsFeature === 'function') {
      return !doc.permissionsPolicy.allowsFeature('display-capture');
    }
  } catch {
    // Ignore unsupported policy APIs
  }
  return false;
}

export function createResilientMediaRecorder(
  stream: MediaStream,
  preferredMimeType: string,
  videoBitsPerSecond: number
): MediaRecorder {
  const hasVideo = stream.getVideoTracks().length > 0;
  const candidates = [
    preferredMimeType,
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
    '',
  ].filter((val, idx, arr) => arr.indexOf(val) === idx);

  let lastError: unknown = null;

  for (const mime of candidates) {
    if (mime && typeof MediaRecorder.isTypeSupported === 'function' && !MediaRecorder.isTypeSupported(mime)) {
      continue;
    }
    try {
      const options: MediaRecorderOptions = {
        audioBitsPerSecond: 128_000,
      };
      if (hasVideo) {
        options.videoBitsPerSecond = videoBitsPerSecond;
      }
      if (mime && hasVideo) {
        options.mimeType = mime;
      }
      return new MediaRecorder(stream, options);
    } catch (err) {
      lastError = err;
    }
  }

  try {
    return new MediaRecorder(stream);
  } catch {
    throw lastError instanceof Error ? lastError : new Error('MediaRecorder initialization failed');
  }
}

export function getInitialSettings(codecs: CodecSupportInfo[]): CaptureSettings {
  return {
    presetId: 'zero-lag-gaming',
    resolution: 'native',
    fps: 60,
    videoBitrateMbps: 10,
    mimeType: getBestLowLagCodec(codecs),
    micEnabled: true,
    systemAudioEnabled: true,
    micGain: 1.0,
    systemGain: 1.0,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    ecoPreviewDuringRec: false,
    autoSaveToDevice: true,
    safeCanvasCapture: false,
    countdownSec: 0,
  };
}

export function applyPresetToSettings(
  current: CaptureSettings,
  presetId: PresetId,
  codecs: CodecSupportInfo[]
): CaptureSettings {
  if (presetId === 'zero-lag-gaming') {
    return {
      ...current,
      presetId,
      resolution: 'native',
      fps: 60,
      videoBitrateMbps: 10,
      mimeType: getBestLowLagCodec(codecs),
      ecoPreviewDuringRec: false,
    };
  }
  if (presetId === 'ultra-1080p60') {
    return {
      ...current,
      presetId,
      resolution: 'native',
      fps: 60,
      videoBitrateMbps: 16,
      mimeType: getBestQualityCodec(codecs),
      ecoPreviewDuringRec: false,
    };
  }
  if (presetId === 'battery-saver') {
    return {
      ...current,
      presetId,
      resolution: '720p',
      fps: 30,
      videoBitrateMbps: 5,
      mimeType: getBestLowLagCodec(codecs),
      ecoPreviewDuringRec: false,
    };
  }
  return {
    ...current,
    presetId: 'custom',
  };
}

export function getResolutionConstraints(resolution: ResolutionOption): {
  width?: { ideal: number };
  height?: { ideal: number };
} {
  switch (resolution) {
    case '1440p':
      return { width: { ideal: 2560 }, height: { ideal: 1440 } };
    case '1080p':
      return { width: { ideal: 1920 }, height: { ideal: 1080 } };
    case '720p':
      return { width: { ideal: 1280 }, height: { ideal: 720 } };
    case 'native':
    default:
      return {};
  }
}

export function getFileExtensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
}

export function buildClipFilename(name: string, mimeType: string): string {
  const ext = getFileExtensionForMime(mimeType);
  const safeName = name.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'FrameZero_Capture';
  return `${safeName}.${ext}`;
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}

export function isDirectoryPickerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'showDirectoryPicker' in window &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function'
  );
}

export function isWebShareFilesSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  );
}

/**
 * Waits until the captured display video track delivers a real decoded frame
 * (videoWidth > 0 && videoHeight > 0) so MediaRecorder never writes a 0x0 or black header.
 */
export async function waitForVideoFrameReady(
  displayStream: MediaStream,
  timeoutMs = 2500
): Promise<{ width: number; height: number }> {
  const videoTrack = displayStream.getVideoTracks()[0];
  if (!videoTrack) return { width: 0, height: 0 };

  const settings = videoTrack.getSettings();
  const tempVideo = document.createElement('video');
  tempVideo.muted = true;
  tempVideo.playsInline = true;
  tempVideo.srcObject = new MediaStream([videoTrack]);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const w = tempVideo.videoWidth || settings.width || 1280;
      const h = tempVideo.videoHeight || settings.height || 720;
      tempVideo.pause();
      tempVideo.srcObject = null;
      resolve({ width: w, height: h });
    };

    const timer = window.setTimeout(finish, timeoutMs);

    const checkFrame = () => {
      if (tempVideo.videoWidth > 0 && tempVideo.videoHeight > 0 && tempVideo.readyState >= 2) {
        // Wait 2 animation frames so the compositor delivers actual pixels
        requestAnimationFrame(() => requestAnimationFrame(finish));
      }
    };

    tempVideo.onloadeddata = checkFrame;
    tempVideo.onplaying = checkFrame;
    void tempVideo.play().then(checkFrame).catch(() => {});
  });
}

/**
 * Compatibility canvas pipeline: decodes live display video frames to an offscreen 2D canvas
 * and captures a fresh MediaStreamTrack, bypassing GPU driver zero-copy black-screen bugs.
 */
export function createCanvasSafePipeline(
  displayStream: MediaStream,
  fps: number,
  initialWidth: number,
  initialHeight: number
): { track: MediaStreamTrack; cleanup: () => void } {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = displayStream;
  void video.play().catch(() => {});

  const canvas = document.createElement('canvas');
  canvas.width = initialWidth || 1280;
  canvas.height = initialHeight || 720;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  let stopped = false;
  const intervalMs = Math.max(16, Math.round(1000 / fps));

  const drawFrame = () => {
    if (stopped || !ctx) return;
    if (video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
  };

  // Use a timer + rAF so frames keep updating cleanly
  const timerId = window.setInterval(drawFrame, intervalMs);
  let rafId = 0;
  const rafLoop = () => {
    if (stopped) return;
    drawFrame();
    rafId = requestAnimationFrame(rafLoop);
  };
  rafId = requestAnimationFrame(rafLoop);

  const canvasStream = canvas.captureStream(fps);
  const track = canvasStream.getVideoTracks()[0];

  const cleanup = () => {
    stopped = true;
    window.clearInterval(timerId);
    cancelAnimationFrame(rafId);
    video.pause();
    video.srcObject = null;
    track?.stop();
  };

  return { track, cleanup };
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${mb.toFixed(1)} MB`;
}

export function measureFramePacing(durationMs = 2000): Promise<FramePacingMetrics> {
  return new Promise((resolve) => {
    const deltas: number[] = [];
    let lastTime = performance.now();
    const startTime = lastTime;
    let rafId = 0;

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;
      if (delta > 0 && delta < 250) {
        deltas.push(delta);
      }

      if (now - startTime >= durationMs && deltas.length >= 10) {
        cancelAnimationFrame(rafId);
        const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length;
        const measuredHz = Math.round(1000 / avg);
        const deviations = deltas.map((d) => Math.abs(d - avg));
        const maxJitterMs = Number(Math.max(...deviations).toFixed(2));
        const droppedFramesEstimate = deltas.filter((d) => d > avg * 1.65).length;

        resolve({
          measuredHz,
          avgFrameMs: Number(avg.toFixed(2)),
          maxJitterMs,
          droppedFramesEstimate,
          sampleCount: deltas.length,
          isMeasuring: false,
        });
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
}
