import React from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import type {
  CaptureSettings,
  CodecSupportInfo,
  CountdownOption,
  FpsOption,
  PresetId,
  ResolutionOption,
} from '../types/recorder';
import type { Translations } from '../i18n/translations';

interface PresetAndAudioPanelProps {
  presetsT: Translations['presets'];
  audioT: Translations['audio'];
  settings: CaptureSettings;
  supportedCodecs: CodecSupportInfo[];
  disabled: boolean;
  isTestingMic: boolean;
  micLevel: number;
  onSelectPreset: (presetId: PresetId) => void;
  onUpdateSettings: (patch: Partial<CaptureSettings>) => void;
  onToggleMicTest: () => void;
}

export const PresetAndAudioPanel: React.FC<PresetAndAudioPanelProps> = ({
  presetsT,
  audioT,
  settings,
  supportedCodecs,
  disabled,
  isTestingMic,
  micLevel,
  onSelectPreset,
  onUpdateSettings,
  onToggleMicTest,
}) => {
  const availableCodecs = supportedCodecs.filter((c) => c.supported);

  const presetItems: Array<{ id: PresetId; title: string; desc: string }> = [
    { id: 'zero-lag-gaming', title: presetsT.zeroLagGaming, desc: presetsT.zeroLagGamingDesc },
    { id: 'ultra-1080p60', title: presetsT.ultraQuality, desc: presetsT.ultraQualityDesc },
    { id: 'battery-saver', title: presetsT.batterySaver, desc: presetsT.batterySaverDesc },
    { id: 'custom', title: presetsT.custom, desc: presetsT.customDesc },
  ];

  const resolutions: ResolutionOption[] = ['native', '1440p', '1080p', '720p'];
  const fpsOptions: FpsOption[] = [30, 60, 120];
  const countdownOptions: CountdownOption[] = [0, 3, 5];

  return (
    <section id="presets" className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
      {/* Left Column: Capture Profile & Zero-Lag Engine */}
      <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#13161D] p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold text-white">{presetsT.sectionTitle}</h2>
          <p className="text-sm text-slate-400">{presetsT.sectionDesc}</p>
        </div>

        {/* Interactive Preset Segmented Selector */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {presetItems.map((item) => {
            const active = settings.presetId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelectPreset(item.id)}
                className={`min-h-[44px] rounded-xl border px-4 py-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 ${
                  active
                    ? 'border-rose-500/60 bg-rose-500/10 text-white'
                    : 'border-white/[0.08] bg-white/[0.02] text-slate-300 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="mt-1 text-xs text-slate-400">{item.desc}</div>
              </button>
            );
          })}
        </div>

        <hr className="border-white/[0.07]" />

        {/* Fine-Grained Video & Zero-Lag Controls */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {/* Resolution */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              {presetsT.resolutionLabel}
            </label>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-[#0B0D11] p-1 border border-white/[0.06]">
              {resolutions.map((res) => (
                <button
                  key={res}
                  type="button"
                  disabled={disabled}
                  onClick={() => onUpdateSettings({ resolution: res, presetId: 'custom' })}
                  className={`min-h-[36px] rounded-md px-2 py-1.5 text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50 ${
                    settings.resolution === res
                      ? 'bg-white text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {res === 'native' ? 'Native' : res}
                </button>
              ))}
            </div>
          </div>

          {/* FPS */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">{presetsT.fpsLabel}</label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#0B0D11] p-1 border border-white/[0.06]">
              {fpsOptions.map((fpsVal) => (
                <button
                  key={fpsVal}
                  type="button"
                  disabled={disabled}
                  onClick={() => onUpdateSettings({ fps: fpsVal, presetId: 'custom' })}
                  className={`min-h-[36px] rounded-md px-2 py-1.5 text-xs font-mono font-medium transition-colors whitespace-nowrap disabled:opacity-50 ${
                    settings.fps === fpsVal
                      ? 'bg-white text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {fpsVal} FPS
                </button>
              ))}
            </div>
          </div>

          {/* Bitrate Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="bitrate-range" className="font-medium text-slate-300">
                {presetsT.bitrateLabel}
              </label>
              <span className="font-mono font-semibold text-white">
                {settings.videoBitrateMbps} Mbps
              </span>
            </div>
            <input
              id="bitrate-range"
              type="range"
              min={2}
              max={25}
              step={1}
              disabled={disabled}
              value={settings.videoBitrateMbps}
              onChange={(e) =>
                onUpdateSettings({ videoBitrateMbps: Number(e.target.value), presetId: 'custom' })
              }
              className="w-full h-2 cursor-pointer rounded-lg bg-[#0B0D11] disabled:opacity-50"
            />
          </div>

          {/* Countdown */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              {presetsT.countdownLabel}
            </label>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-[#0B0D11] p-1 border border-white/[0.06]">
              {countdownOptions.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  disabled={disabled}
                  onClick={() => onUpdateSettings({ countdownSec: sec })}
                  className={`min-h-[36px] rounded-md px-2 py-1.5 text-xs font-mono font-medium transition-colors whitespace-nowrap disabled:opacity-50 ${
                    settings.countdownSec === sec
                      ? 'bg-white text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sec === 0 ? 'Instant' : `${sec}s`}
                </button>
              ))}
            </div>
          </div>

          {/* Encoder Codec Select */}
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="codec-select" className="block text-xs font-medium text-slate-300">
              {presetsT.codecLabel}
            </label>
            <select
              id="codec-select"
              disabled={disabled || availableCodecs.length === 0}
              value={settings.mimeType}
              onChange={(e) => onUpdateSettings({ mimeType: e.target.value, presetId: 'custom' })}
              className="w-full min-h-[44px] rounded-lg border border-white/[0.08] bg-[#0B0D11] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
            >
              {availableCodecs.length > 0 ? (
                availableCodecs.map((codec) => (
                  <option key={codec.mimeType} value={codec.mimeType}>
                    {codec.label} — {codec.cpuProfile}
                  </option>
                ))
              ) : (
                <option value="">Browser Default Codec</option>
              )}
            </select>
          </div>
        </div>

        <hr className="border-white/[0.07]" />

        {/* Eco Preview Offload Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <div className="text-sm font-semibold text-white">{presetsT.ecoPreviewLabel}</div>
            <p className="text-xs text-slate-400">{presetsT.ecoPreviewHint}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.ecoPreviewDuringRec}
            onClick={() =>
              onUpdateSettings({ ecoPreviewDuringRec: !settings.ecoPreviewDuringRec })
            }
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${
              settings.ecoPreviewDuringRec ? 'bg-rose-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                settings.ecoPreviewDuringRec ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Right Column: Dual Audio Mixer */}
      <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#13161D] p-6 space-y-6">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold text-white">{audioT.sectionTitle}</h2>
          <p className="text-sm text-slate-400">{audioT.sectionDesc}</p>
        </div>

        {/* Microphone Channel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onUpdateSettings({ micEnabled: !settings.micEnabled })}
              className={`inline-flex min-h-[44px] items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                settings.micEnabled
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-white/[0.08] bg-white/[0.02] text-slate-400'
              }`}
            >
              {settings.micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              <span>
                {audioT.micLabel} · {settings.micEnabled ? audioT.micOn : audioT.micOff}
              </span>
            </button>

            <button
              type="button"
              disabled={disabled || !settings.micEnabled}
              onClick={onToggleMicTest}
              className="min-h-[44px] rounded-lg border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap disabled:opacity-40"
            >
              {isTestingMic ? audioT.stopTestBtn : audioT.testMicBtn}
            </button>
          </div>

          {/* Live Mic Meter Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{isTestingMic ? audioT.micActivePrompt : audioT.micGain}</span>
              <span className="font-mono text-white">
                {Math.round(settings.micGain * 100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#0B0D11]">
              <div
                className="h-full bg-emerald-500 transition-[width] duration-75"
                style={{ width: `${settings.micEnabled ? Math.min(100, micLevel) : 0}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              disabled={!settings.micEnabled}
              value={settings.micGain}
              onChange={(e) => onUpdateSettings({ micGain: Number(e.target.value) })}
              aria-label={audioT.micGain}
              className="w-full h-2 cursor-pointer rounded-lg bg-[#0B0D11] disabled:opacity-40"
            />
          </div>
        </div>

        <hr className="border-white/[0.07]" />

        {/* Game / System Audio Channel */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onUpdateSettings({ systemAudioEnabled: !settings.systemAudioEnabled })}
              className={`inline-flex min-h-[44px] items-center gap-2.5 rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                settings.systemAudioEnabled
                  ? 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                  : 'border-white/[0.08] bg-white/[0.02] text-slate-400'
              }`}
            >
              {settings.systemAudioEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span>{audioT.systemAudioLabel}</span>
            </button>
            <span className="font-mono text-xs text-white">
              {Math.round(settings.systemGain * 100)}%
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={1.5}
            step={0.05}
            disabled={!settings.systemAudioEnabled}
            value={settings.systemGain}
            onChange={(e) => onUpdateSettings({ systemGain: Number(e.target.value) })}
            aria-label={audioT.systemGain}
            className="w-full h-2 cursor-pointer rounded-lg bg-[#0B0D11] disabled:opacity-40"
          />
          <p className="text-xs text-slate-400 leading-relaxed">{audioT.systemAudioHint}</p>
        </div>

        <hr className="border-white/[0.07]" />

        {/* Audio DSP Toggles */}
        <div className="space-y-2.5">
          {(
            [
              { key: 'noiseSuppression', label: audioT.noiseSuppression },
              { key: 'echoCancellation', label: audioT.echoCancellation },
              { key: 'autoGainControl', label: audioT.autoGain },
            ] as const
          ).map((item) => {
            const active = settings[item.key];
            return (
              <div key={item.key} className="flex items-center justify-between py-1">
                <span className="text-sm text-slate-300">{item.label}</span>
                <button
                  type="button"
                  role="switch"
                  disabled={disabled || !settings.micEnabled}
                  aria-checked={active}
                  onClick={() => onUpdateSettings({ [item.key]: !active })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-40 ${
                    active ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
