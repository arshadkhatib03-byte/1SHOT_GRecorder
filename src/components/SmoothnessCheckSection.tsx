import React from 'react';
import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import type { CodecSupportInfo, FramePacingMetrics } from '../types/recorder';
import type { Translations } from '../i18n/translations';

interface SmoothnessCheckSectionProps {
  t: Translations['smoothness'];
  codecs: CodecSupportInfo[];
  recommendedCodecMime: string;
  metrics: FramePacingMetrics | null;
  isMeasuring: boolean;
  onRunBenchmark: () => void;
}

export const SmoothnessCheckSection: React.FC<SmoothnessCheckSectionProps> = ({
  t,
  codecs,
  recommendedCodecMime,
  metrics,
  isMeasuring,
  onRunBenchmark,
}) => {
  return (
    <section id="smoothness" className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1 max-w-2xl">
          <h2 className="font-display text-2xl font-semibold text-white">{t.sectionTitle}</h2>
          <p className="text-sm text-slate-400">{t.sectionDesc}</p>
        </div>

        <button
          type="button"
          disabled={isMeasuring}
          onClick={onRunBenchmark}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
        >
          <Activity className="h-4 w-4 text-emerald-400" />
          <span>{isMeasuring ? t.measuring : t.runBenchmarkBtn}</span>
        </button>
      </div>

      {/* Real Measured Frame-Pacing KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#13161D] p-5">
          <div className="text-xs font-medium text-slate-400">{t.refreshRate}</div>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {metrics ? `${metrics.measuredHz} Hz` : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#13161D] p-5">
          <div className="text-xs font-medium text-slate-400">{t.frameTime}</div>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {metrics ? `${metrics.avgFrameMs} ms` : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#13161D] p-5">
          <div className="text-xs font-medium text-slate-400">{t.jitter}</div>
          <div className="mt-2 font-mono text-2xl font-bold text-white">
            {metrics ? `±${metrics.maxJitterMs} ms` : '—'}
          </div>
        </div>
      </div>

      {/* Codec Probe Table & Zero-Lag Engineering Notes */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#13161D] p-6 space-y-4">
          <h3 className="font-display text-base font-semibold text-white">
            {t.codecMatrixTitle}
          </h3>
          <div className="divide-y divide-white/[0.06]">
            {codecs.map((codec) => {
              const isRec = codec.mimeType === recommendedCodecMime && codec.supported;
              return (
                <div
                  key={codec.mimeType}
                  className="flex items-center justify-between gap-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-white truncate">
                      {codec.label}
                      {isRec && (
                        <span className="ms-2 text-xs font-semibold text-emerald-400">
                          · {t.recommended}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono truncate">
                      {codec.cpuProfile}
                    </div>
                  </div>
                  <div className="shrink-0">
                    {codec.supported ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{t.supported}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <XCircle className="h-4 w-4" />
                        <span>{t.notSupported}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#13161D] p-6 space-y-5">
          <h3 className="font-display text-base font-semibold text-white">
            {t.zeroLagTipsTitle}
          </h3>
          <div className="space-y-4 divide-y divide-white/[0.06]">
            <div className="pt-1">
              <div className="text-sm font-semibold text-white">01. {t.tip1Title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.tip1Desc}</p>
            </div>
            <div className="pt-4">
              <div className="text-sm font-semibold text-white">02. {t.tip2Title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.tip2Desc}</p>
            </div>
            <div className="pt-4">
              <div className="text-sm font-semibold text-white">03. {t.tip3Title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.tip3Desc}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
