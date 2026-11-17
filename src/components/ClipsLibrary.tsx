import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Edit3, Film, Play, Search, Share2, Trash2, X } from 'lucide-react';
import type { RecordedClip } from '../types/recorder';
import type { Translations } from '../i18n/translations';
import { formatBytes, formatDuration, getFileExtensionForMime } from '../utils/captureEngine';

interface ClipsLibraryProps {
  t: Translations['clips'];
  clips: RecordedClip[];
  activeClipId: string | null;
  onSelectClipId: (id: string | null) => void;
  canShareFiles: boolean;
  onStartFirstRecording: () => void;
  onDownloadClip: (clip: RecordedClip) => void;
  onShareClip: (clip: RecordedClip) => void;
  onDeleteClip: (id: string) => void;
  onRenameClip: (id: string, newName: string) => void;
}

type ClipFilter = 'all' | 'mic' | 'high-fps';

export const ClipsLibrary: React.FC<ClipsLibraryProps> = ({
  t,
  clips,
  activeClipId,
  onSelectClipId,
  canShareFiles,
  onStartFirstRecording,
  onDownloadClip,
  onShareClip,
  onDeleteClip,
  onRenameClip,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ClipFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPlaybackError(null);
  }, [activeClipId]);

  const filteredClips = useMemo(() => {
    return clips.filter((clip) => {
      if (filter === 'mic' && !clip.hasMic) return false;
      if (filter === 'high-fps' && clip.fps < 60) return false;
      if (searchQuery.trim()) {
        return clip.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [clips, filter, searchQuery]);

  const activeClip = useMemo(
    () => clips.find((c) => c.id === activeClipId) ?? null,
    [clips, activeClipId]
  );

  const startRename = (clip: RecordedClip) => {
    setEditingId(clip.id);
    setDraftName(clip.name);
  };

  const commitRename = (id: string) => {
    const trimmed = draftName.trim();
    if (trimmed) {
      onRenameClip(id, trimmed);
    }
    setEditingId(null);
  };

  return (
    <section id="clips" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-2xl font-semibold text-white">{t.sectionTitle}</h2>

        {clips.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="min-h-[40px] w-full sm:w-56 rounded-lg border border-white/[0.08] bg-[#13161D] pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#13161D] p-1">
              {(
                [
                  { id: 'all', label: t.filterAll },
                  { id: 'mic', label: t.filterMic },
                  { id: 'high-fps', label: t.filterHighFps },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`min-h-[32px] rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    filter === tab.id
                      ? 'bg-white text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline Playback Player */}
      {activeClip && activeClip.blobUrl && (
        <div
          ref={playerContainerRef}
          className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#13161D]"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-6">
            <div className="min-w-0">
              <div className="font-semibold text-white truncate">{activeClip.name}</div>
              <div className="text-xs text-slate-400 font-mono">
                {activeClip.width > 0 ? `${activeClip.width}x${activeClip.height}` : 'Audio'} ·{' '}
                {activeClip.fps} FPS · {formatDuration(activeClip.durationSec)} ·{' '}
                {formatBytes(activeClip.sizeBytes)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectClipId(null)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
              <span>{t.closePlayer}</span>
            </button>
          </div>
          <div className="bg-black flex flex-col items-center justify-center">
            <video
              key={activeClip.id}
              src={activeClip.blobUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onError={() =>
                setPlaybackError(
                  'This browser could not preview the recorded codec inline. Click Download to play it in your device video player.'
                )
              }
              className="aspect-video max-h-[540px] w-full bg-black object-contain"
            />
            {playbackError && (
              <div className="w-full border-t border-white/10 bg-rose-950/40 px-4 py-2.5 text-xs text-rose-200">
                {playbackError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State or Clip Rows */}
      {clips.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#13161D] px-6 py-14 text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-[#181C24] text-slate-400">
            <Film className="h-6 w-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="font-display text-lg font-semibold text-white">{t.emptyTitle}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{t.emptyDesc}</p>
          </div>
          <button
            type="button"
            onClick={onStartFirstRecording}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-200 transition-colors"
          >
            {t.emptyCta}
          </button>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#13161D]">
          {filteredClips.map((clip) => {
            const ext = getFileExtensionForMime(clip.mimeType).toUpperCase();
            const isEditing = editingId === clip.id;
            return (
              <div
                key={clip.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(clip.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="min-h-[36px] rounded-md border border-white/20 bg-[#0B0D11] px-2.5 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(clip.id)}
                        className="min-h-[36px] rounded-md bg-white px-3 text-xs font-semibold text-slate-950"
                      >
                        {t.saveName}
                      </button>
                    </div>
                  ) : (
                    <div className="font-semibold text-white truncate">{clip.name}</div>
                  )}

                  {/* Zero-pill unboxed metadata line */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono">
                    <span>
                      {clip.width > 0 ? `${clip.width}x${clip.height}` : 'Audio'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{clip.fps} FPS</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDuration(clip.durationSec)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(clip.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{ext}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-sans">
                      {clip.hasMic ? t.micIncluded : t.screenOnly}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectClipId(clip.id);
                      window.setTimeout(() => {
                        playerContainerRef.current?.scrollIntoView({
                          behavior: 'smooth',
                          block: 'nearest',
                        });
                      }, 60);
                    }}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Play</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDownloadClip(clip)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-slate-200 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{t.download}</span>
                  </button>

                  {canShareFiles && (
                    <button
                      type="button"
                      onClick={() => onShareClip(clip)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10 transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      <span>{t.shareSave}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => startRename(clip)}
                    aria-label={t.rename}
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteClip(clip.id)}
                    aria-label={t.delete}
                    className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
