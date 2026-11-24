import { Check, ListChecks, Loader2, Music2, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { LIKED_MUSIC_PLAYLIST } from '@/data/music/library';
import {
  useAddTracksToPlaylists,
  useCreatePlaylist,
  useLibraryPlaylists,
  usePlaylistOptions,
} from '@/data/music/queries';
import { sizedArtwork } from '@/lib/artwork';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { useBatchSelect } from '@/state/batchSelect';
import { useUi } from '@/state/ui';

interface DisplayPlaylist {
  playlistId: string;
  title: string;
  thumbnail: string | null;
}

/**
 * Multi-Playlist Slide-Up Bottom Sheet:
 * - Check MULTIPLE playlists at once (never closes after tapping the first one)
 * - Supports adding 1 track OR multiple selected tracks in one batched operation
 * - Includes "+ Pick more songs" to jump straight to Home/Search multi-select
 * - Includes inline "+ New Playlist" creation
 */
export function MultiPlaylistSheet() {
  const open = useBatchSelect((s) => s.pickerOpen);
  const tracks = useBatchSelect((s) => s.pickerTracks);
  const { closePlaylistPicker, startSelecting, stopSelecting, showToast } = useBatchSelect.getState();

  const firstVideoId = tracks[0]?.videoId ?? '';
  const options = usePlaylistOptions(firstVideoId, open && !!firstVideoId);
  const libraryPlaylists = useLibraryPlaylists();
  const addBatch = useAddTracksToPlaylists();
  const createPlaylist = useCreatePlaylist();

  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const swipeStartY = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedIds([]);
      setFilter('');
      setCreating(false);
      setNewTitle('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePlaylistPicker();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closePlaylistPicker]);

  const playlists = useMemo<DisplayPlaylist[]>(() => {
    const thumbById = new Map<string, string | null>();
    for (const item of libraryPlaylists.data ?? []) {
      const cleanId = item.id.replace(/^VL/, '');
      thumbById.set(cleanId, item.thumbnail);
    }

    const fromOptions = (options.data ?? []).map((opt) => {
      const cleanId = opt.playlistId.replace(/^VL/, '');
      return {
        playlistId: cleanId,
        title: opt.title,
        thumbnail: thumbById.get(cleanId) ?? null,
      };
    });

    if (fromOptions.length > 0) return fromOptions;

    // Fallback to user's library playlists (excluding auto/watch-later/liked) if get_add_to_playlist is empty.
    return (libraryPlaylists.data ?? [])
      .map((item) => ({
        playlistId: item.id.replace(/^VL/, ''),
        title: item.title,
        thumbnail: item.thumbnail,
      }))
      .filter((p) => {
        const lower = p.title.trim().toLowerCase();
        return (
          p.playlistId &&
          p.playlistId !== LIKED_MUSIC_PLAYLIST &&
          p.playlistId !== 'LL' &&
          p.playlistId !== 'WL' &&
          lower !== 'liked music' &&
          lower !== 'liked videos' &&
          lower !== 'saved shorts'
        );
      });
  }, [options.data, libraryPlaylists.data]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return playlists;
    return playlists.filter((p) => p.title.toLowerCase().includes(q));
  }, [playlists, filter]);

  if (!open || !tracks.length) return null;

  const isLoading = options.isPending && playlists.length === 0;
  const isSaving = addBatch.isPending || createPlaylist.isPending;

  const togglePlaylist = (playlistId: string) => {
    triggerHaptic('light');
    setSelectedIds((prev) =>
      prev.includes(playlistId) ? prev.filter((id) => id !== playlistId) : [...prev, playlistId],
    );
  };

  const handleSave = async () => {
    if (!selectedIds.length || isSaving) return;
    triggerHaptic('medium');
    try {
      await addBatch.mutateAsync({
        playlistIds: selectedIds,
        videoIds: tracks.map((t) => t.videoId),
      });
      const songWord = tracks.length === 1 ? 'song' : 'songs';
      const plWord = selectedIds.length === 1 ? 'playlist' : 'playlists';
      showToast(`Added ${tracks.length} ${songWord} to ${selectedIds.length} ${plWord}`);
      closePlaylistPicker();
      if (useBatchSelect.getState().selecting) stopSelecting();
    } catch {
      showToast('Could not add to playlists');
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || isSaving) return;
    triggerHaptic('medium');
    try {
      await createPlaylist.mutateAsync({
        title: trimmed,
        videoIds: tracks.map((t) => t.videoId),
      });
      const songWord = tracks.length === 1 ? 'song' : 'songs';
      showToast(`Created “${trimmed}” with ${tracks.length} ${songWord}`);
      closePlaylistPicker();
      if (useBatchSelect.getState().selecting) stopSelecting();
    } catch {
      showToast('Could not create playlist');
    }
  };

  const handlePickMoreSongs = () => {
    const initial = tracks;
    closePlaylistPicker();
    if (initial.length === 1) {
      startSelecting(initial[0]);
    } else {
      useBatchSelect.setState({ selecting: true, selectedTracks: initial });
      triggerHaptic('medium');
    }
    useUi.setState({ mobileConsoleOpen: false, fullScreen: false });
    if (!pathname.startsWith('/home') && !pathname.startsWith('/search')) {
      navigate('/home');
    }
    showToast('Tap songs on Home or Search to add more');
  };

  const singleTrack = tracks.length === 1 ? tracks[0]! : null;
  const singleArtist = singleTrack ? singleTrack.artists.map((a) => a.name).filter(Boolean).join(', ') : '';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add to Playlists"
      className="animate-scrim-in fixed inset-0 z-[10060] flex items-end justify-center bg-black/68 backdrop-blur-md"
      onClick={() => {
        if (!isSaving) closePlaylistPicker();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          swipeStartY.current = e.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(e) => {
          const y0 = swipeStartY.current;
          swipeStartY.current = null;
          const y1 = e.changedTouches[0]?.clientY;
          if (y0 != null && y1 != null && y1 - y0 > 68 && !isSaving) {
            triggerHaptic('light');
            closePlaylistPicker();
          }
        }}
        className="animate-sheet-up relative flex max-h-[84dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[28px] border-t border-x border-white/[0.12] bg-[#0b101d]/97 px-4 pt-2.5 shadow-[0_-22px_64px_rgba(0,0,0,0.82)] backdrop-blur-3xl"
        style={{
          paddingBottom: 'max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
          backgroundImage:
            'radial-gradient(ellipse 90% 38% at 50% 0%, rgba(var(--accent-rgb), 0.22) 0%, transparent 72%)',
        }}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-2.5 h-1 w-10 flex-none rounded-full bg-white/20" aria-hidden="true" />

        {/* Sheet Header */}
        <div className="flex flex-none items-center justify-between gap-2 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            {singleTrack ? (
              <div className="grid size-11 flex-none place-items-center overflow-hidden rounded-[10px] bg-[#141c2f] ring-1 ring-white/15">
                {singleTrack.thumbnail ? (
                  <img
                    src={sizedArtwork(singleTrack.thumbnail, 120)}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                  />
                ) : (
                  <Music2 size={17} className="text-secondary" />
                )}
              </div>
            ) : (
              <div className="flex flex-none -space-x-2.5">
                {tracks.slice(0, 3).map((t) => (
                  <div
                    key={t.videoId}
                    className="grid size-10 place-items-center overflow-hidden rounded-[10px] border-2 border-[#0b101d] bg-[#141c2f]"
                  >
                    {t.thumbnail ? (
                      <img
                        src={sizedArtwork(t.thumbnail, 100)}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="size-full object-cover"
                      />
                    ) : (
                      <Music2 size={14} className="text-secondary" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex min-w-0 flex-col">
              <h2 className="text-[16.5px] font-bold leading-tight text-primary">Add to Playlists</h2>
              <span className="mt-0.5 truncate text-[12px] text-secondary">
                {singleTrack
                  ? cleanTrackTitle(singleTrack.title, singleArtist)
                  : `${tracks.length} songs selected`}
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={closePlaylistPicker}
            aria-label="Close"
            className="grid size-8 flex-none place-items-center rounded-full bg-white/[0.07] text-secondary hover:text-primary active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick Utility Strip: + Pick More Songs | + New Playlist */}
        <div className="mb-3 flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={handlePickMoreSongs}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.11] bg-white/[0.05] px-3 text-[12.5px] font-semibold text-primary transition-colors hover:bg-white/[0.09] active:scale-[0.97]"
          >
            <ListChecks size={14} style={{ color: 'var(--accent-bright)' }} />
            <span>{tracks.length > 1 ? `Pick More (${tracks.length})` : 'Pick More Songs'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              setCreating((v) => !v);
            }}
            className="inline-flex h-9 flex-none items-center justify-center gap-1.5 rounded-full border border-white/[0.11] bg-white/[0.05] px-3.5 text-[12.5px] font-semibold text-primary transition-colors hover:bg-white/[0.09] active:scale-[0.97]"
            style={
              creating
                ? {
                    borderColor: 'rgba(var(--accent-rgb), 0.55)',
                    backgroundColor: 'rgba(var(--accent-rgb), 0.2)',
                    color: 'var(--accent-bright)',
                  }
                : undefined
            }
          >
            <Plus size={14} />
            <span>New Playlist</span>
          </button>
        </div>

        {/* Inline New Playlist Creator */}
        {creating && (
          <form
            onSubmit={handleCreatePlaylist}
            className="mb-3 flex flex-none items-center gap-2 rounded-[16px] border border-white/[0.11] bg-white/[0.04] p-2"
          >
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="New playlist name…"
              autoFocus
              className="h-9 min-w-0 flex-1 bg-transparent px-2 text-[14px] font-medium text-primary placeholder:text-tertiary"
            />
            <button
              type="submit"
              disabled={!newTitle.trim() || isSaving}
              className="inline-flex h-9 flex-none items-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold text-white transition-all active:scale-95 disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent-hex)' }}
            >
              {createPlaylist.isPending ? <Loader2 size={14} className="animate-spin" /> : <span>Create</span>}
            </button>
          </form>
        )}

        {/* Filter Bar (when 5+ playlists) */}
        {playlists.length >= 5 && (
          <div className="relative mb-2.5 flex flex-none items-center">
            <Search size={14} className="pointer-events-none absolute left-3 text-tertiary" />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter your playlists…"
              className="h-10 w-full rounded-[14px] border border-white/[0.09] bg-white/[0.04] pr-3 pl-9 text-[13.5px] text-primary placeholder:text-tertiary"
            />
          </div>
        )}

        {/* Scrollable Multi-Select Playlist List */}
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-secondary">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-bright)' }} />
              <span>Loading your playlists…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-[13px] text-secondary">
              {playlists.length === 0 ? 'No playlists found yet — tap New Playlist above.' : 'No matching playlists.'}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filtered.map((pl) => {
                const checked = selectedIds.includes(pl.playlistId);
                return (
                  <button
                    key={pl.playlistId}
                    type="button"
                    onClick={() => togglePlaylist(pl.playlistId)}
                    aria-pressed={checked}
                    className="flex min-h-[58px] w-full items-center gap-3 rounded-[16px] border px-2.5 py-2 text-left transition-all duration-150 active:scale-[0.985]"
                    style={
                      checked
                        ? {
                            borderColor: 'rgba(var(--accent-rgb), 0.5)',
                            backgroundColor: 'rgba(var(--accent-rgb), 0.14)',
                          }
                        : {
                            borderColor: 'rgba(255, 255, 255, 0.06)',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)',
                          }
                    }
                  >
                    <div className="grid size-11 flex-none place-items-center overflow-hidden rounded-[10px] bg-[#141c2f] ring-1 ring-white/12">
                      {pl.thumbnail ? (
                        <img
                          src={sizedArtwork(pl.thumbnail, 120)}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="size-full object-cover"
                        />
                      ) : (
                        <Music2 size={17} style={{ color: 'var(--accent-bright)' }} />
                      )}
                    </div>

                    <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-primary">
                      {pl.title}
                    </span>

                    {/* Circular Dynamic-Accent Checkbox */}
                    <span
                      aria-hidden="true"
                      className="grid size-6 flex-none place-items-center rounded-full border transition-all duration-150"
                      style={
                        checked
                          ? {
                              borderColor: 'var(--accent-hex)',
                              backgroundColor: 'var(--accent-hex)',
                              boxShadow: '0 0 12px rgba(var(--accent-rgb), 0.5)',
                            }
                          : {
                              borderColor: 'rgba(255, 255, 255, 0.25)',
                              backgroundColor: 'transparent',
                            }
                      }
                    >
                      {checked && <Check size={14} strokeWidth={3} className="text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Bottom CTA Button */}
        <div className="mt-3 flex flex-none items-center gap-2 border-t border-white/[0.08] pt-3">
          <button
            type="button"
            disabled={selectedIds.length === 0 || isSaving}
            onClick={handleSave}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[14.5px] font-bold text-white transition-all duration-150 active:scale-[0.98] disabled:opacity-40"
            style={{
              backgroundColor: 'var(--accent-hex)',
              boxShadow:
                selectedIds.length > 0
                  ? '0 8px 26px rgba(var(--accent-rgb), 0.45), inset 0 1px 0 rgba(255,255,255,0.24)'
                  : undefined,
            }}
          >
            {addBatch.isPending ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>Adding…</span>
              </>
            ) : selectedIds.length === 0 ? (
              <span>Select playlists above</span>
            ) : tracks.length === 1 ? (
              <span>
                Add to {selectedIds.length} {selectedIds.length === 1 ? 'Playlist' : 'Playlists'}
              </span>
            ) : (
              <span>
                Add {tracks.length} Songs to {selectedIds.length} {selectedIds.length === 1 ? 'Playlist' : 'Playlists'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
