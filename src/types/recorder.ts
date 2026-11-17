export type PresetId = 'zero-lag-gaming' | 'ultra-1080p60' | 'battery-saver' | 'custom';

export type ResolutionOption = 'native' | '1440p' | '1080p' | '720p';

export type FpsOption = 30 | 60 | 120;

export type CountdownOption = 0 | 3 | 5;

export type CaptureState = 'idle' | 'countdown' | 'recording' | 'paused';

export interface CaptureSettings {
  presetId: PresetId;
  resolution: ResolutionOption;
  fps: FpsOption;
  videoBitrateMbps: number;
  mimeType: string;
  micEnabled: boolean;
  systemAudioEnabled: boolean;
  micGain: number; // 0 to 1.5
  systemGain: number; // 0 to 1.5
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  ecoPreviewDuringRec: boolean; // Zero-lag preview offload during active recording
  countdownSec: CountdownOption;
}

export interface CodecSupportInfo {
  mimeType: string;
  label: string;
  container: 'mp4' | 'webm';
  cpuProfile: 'Low CPU (Hardware)' | 'Balanced' | 'High Detail';
  supported: boolean;
}

export interface RecordedClip {
  id: string;
  name: string;
  createdAt: number;
  durationSec: number;
  sizeBytes: number;
  width: number;
  height: number;
  fps: number;
  mimeType: string;
  hasMic: boolean;
  hasSystemAudio: boolean;
  blobUrl?: string;
}

export interface FramePacingMetrics {
  measuredHz: number;
  avgFrameMs: number;
  maxJitterMs: number;
  droppedFramesEstimate: number;
  sampleCount: number;
  isMeasuring: boolean;
}
