import type {
  CaptureSettings,
  CodecSupportInfo,
  FramePacingMetrics,
  PresetId,
  ResolutionOption,
} from '../types/recorder';

const CANDIDATE_CODECS: Array<Omit<CodecSupportInfo, 'supported'>> = [
  {
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    label: 'H.264 + AAC (MP4)',
    container: 'mp4',
    cpuProfile: 'Low CPU (Hardware)',
  },
  {
    mimeType: 'video/webm;codecs=h264,opus',
    label: 'H.264 + Opus (WebM)',
    container: 'webm',
    cpuProfile: 'Low CPU (Hardware)',
  },
  {
    mimeType: 'video/webm;codecs=vp8,opus',
    label: 'VP8 + Opus (WebM)',
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
  // Prefer hardware-accelerated H.264 or lightweight VP8 for gaming zero-lag
  const preferredOrder = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm',
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
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/webm;codecs=h264,opus',
    'video/webm;codecs=vp8,opus',
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

export function getInitialSettings(codecs: CodecSupportInfo[]): CaptureSettings {
  return {
    presetId: 'zero-lag-gaming',
    resolution: '1080p',
    fps: 60,
    videoBitrateMbps: 10,
    mimeType: getBestLowLagCodec(codecs),
    micEnabled: true,
    systemAudioEnabled: true,
    micGain: 1.0,
    systemGain: 0.9,
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    ecoPreviewDuringRec: true,
    countdownSec: 3,
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
      resolution: '1080p',
      fps: 60,
      videoBitrateMbps: 10,
      mimeType: getBestLowLagCodec(codecs),
      ecoPreviewDuringRec: true,
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
      ecoPreviewDuringRec: true,
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
      ecoPreviewDuringRec: true,
    };
  }
  return {
    ...current,
    presetId: 'custom',
  };
}

export function getResolutionConstraints(resolution: ResolutionOption): {
  width?: { ideal: number; max: number };
  height?: { ideal: number; max: number };
} {
  switch (resolution) {
    case '1440p':
      return { width: { ideal: 2560, max: 2560 }, height: { ideal: 1440, max: 1440 } };
    case '1080p':
      return { width: { ideal: 1920, max: 1920 }, height: { ideal: 1080, max: 1080 } };
    case '720p':
      return { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 } };
    case 'native':
    default:
      return {};
  }
}

export function getFileExtensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  return 'webm';
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
