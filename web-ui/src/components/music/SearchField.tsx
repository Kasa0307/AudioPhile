import { ArrowUpRight, Check, Search, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { useSuggestions } from '@/data/music/queries';
import type { MusicItem } from '@/data/music/types';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { useBatchSelect } from '@/state/batchSelect';
import { useUi } from '@/state/ui';
import { Artwork } from './Artwork';
import { hrefFor } from './links';
import { playTrack, toTrack } from './play';
import { TrackMenu } from './TrackMenu';

type Option = { kind: 'query'; text: string; typed: string; rest: string } | { kind: 'item'; item: MusicItem };

function kindLabel(kind: MusicItem['kind']): string {
  switch (kind) {
    case 'song':
      return 'Track';
    case 'video':
      return 'Video';
    case 'album':
      return 'Album';
    case 'artist':
      return 'Artist';
    case 'playlist':
    case 'spotify-playlist':
      return 'Playlist';
    default:
      return '';
  }
}

/**
 * Full-Width Acoustic Glass Slide-Up Search Sheet:
 * Rises smoothly from the bottom (matching Add to Playlist & Track Options),
 * supports Android Back gesture dismissal, instant query completions,
 * direct track/artist/album results, and Multi-Select Mode checkmarks.
 */
export function SearchField({
  initial,
  onSearch,
  onFocusChange,
}: {
  initial: string;
  onSearch: (query: string) => void;
  onFocusChange?: (focused: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const swipeStartY = useRef<number | null>(null);
  const navigate = useNavigate();

  const selecting = useBatchSelect((s) => s.selecting);
  const selectedTracks = useBatchSelect((s) => s.selectedTracks);
  const toggleTrack = useBatchSelect((s) => s.toggleTrack);

  const suggestions = useSuggestions(sheetOpen ? value : '');

  useEffect(() => setValue(initial), [initial]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    onFocusChange?.(false);
  }, [onFocusChange]);

  const openSheet = useCallback(() => {
    triggerHaptic('light');
    setSheetOpen(true);
    onFocusChange?.(true);
  }, [onFocusChange]);

  // Register sheet with Android Back handler & auto-focus input cleanly
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSheet();
    };
    window.addEventListener('keydown', onKey);
    useUi.getState().setActiveMenuClose(closeSheet);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKey);
      if (useUi.getState().activeMenuClose === closeSheet) {
        useUi.getState().setActiveMenuClose(null);
      }
    };
  }, [sheetOpen, closeSheet]);

  const options: Option[] = [
    ...(suggestions.data?.queries ?? []).map((q) => ({ kind: 'query' as const, ...q })),
    ...(suggestions.data?.items ?? []).map((item) => ({ kind: 'item' as const, item })),
  ];

  const submitQuery = (raw: string) => {
    const trimmed = raw.trim();
    closeSheet();
    onSearch(trimmed);
  };

  const pickOption = (option: Option) => {
    if (option.kind === 'query') {
      triggerHaptic('light');
      setValue(option.text);
      submitQuery(option.text);
      return;
    }
    const item = option.item;
    const playable = item.kind === 'song' || item.kind === 'video';
    if (selecting && playable) {
      toggleTrack(toTrack(item));
      return;
    }
    triggerHaptic('light');
    const href = hrefFor(item);
    closeSheet();
    if (href) navigate(href);
    else playTrack(item);
  };

  return (
    <>
      {/* Tactile Elevated Search Lens Trigger Bar */}
      <div className="relative flex w-full max-w-[540px] items-center">
        <button
          type="button"
          onClick={openSheet}
          aria-label="Open search"
          className="flex h-[46px] w-full items-center gap-2.5 rounded-full border border-white/[0.12] bg-[#101625]/84 pr-11 pl-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_10px_28px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all duration-150 active:scale-[0.99]"
        >
          <Search size={16} strokeWidth={2.3} className="flex-none text-secondary" />
          <span className={`truncate text-[14.5px] font-medium ${value ? 'text-primary' : 'text-tertiary'}`}>
            {value || 'Search tracks, artists, albums…'}
          </span>
        </button>

        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic('light');
              setValue('');
              onSearch('');
            }}
            className="absolute right-2.5 grid size-7 place-items-center rounded-full bg-white/[0.1] text-secondary hover:text-primary active:scale-90"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        )}
      </div>

      {/* Full-Width Slide-Up Acoustic Glass Search Sheet */}
      {sheetOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search Audiophile"
            className="fixed inset-0 z-[10055] flex items-end justify-center bg-black/68 backdrop-blur-md"
            onClick={closeSheet}
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
                if (y0 != null && y1 != null && y1 - y0 > 78) {
                  triggerHaptic('light');
                  closeSheet();
                }
              }}
              className="animate-sheet-up relative flex h-[86dvh] w-full max-w-[540px] flex-col overflow-hidden rounded-t-[28px] border-t border-x border-white/[0.12] bg-[#0b101d]/98 px-4 pt-2.5 shadow-[0_-24px_64px_rgba(0,0,0,0.85)] backdrop-blur-3xl"
              style={{
                paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
                backgroundImage:
                  'radial-gradient(ellipse 90% 35% at 50% 0%, rgba(var(--accent-rgb), 0.22) 0%, transparent 72%)',
              }}
            >
              {/* Drag handle */}
              <div className="mx-auto mb-3 h-1 w-10 flex-none rounded-full bg-white/20" aria-hidden="true" />

              {/* Full-Width Search Input Row */}
              <form
                role="search"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitQuery(value);
                }}
                className="mb-3 flex flex-none items-center gap-2"
              >
                <div
                  className="relative flex flex-1 items-center rounded-full border bg-[#12192b]/90 px-3.5 transition-all"
                  style={{
                    borderColor: 'rgba(var(--accent-rgb), 0.55)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 0 0 3px rgba(var(--accent-rgb), 0.14)',
                  }}
                >
                  <Search size={16} strokeWidth={2.3} style={{ color: 'var(--accent-bright)' }} className="flex-none" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={value}
                    placeholder="Search tracks, artists, albums…"
                    autoComplete="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    onChange={(e) => setValue(e.target.value)}
                    className="h-[44px] w-full bg-transparent px-2.5 text-[15px] font-medium text-primary placeholder:text-tertiary [&::-webkit-search-cancel-button]:hidden"
                  />
                  {value && (
                    <button
                      type="button"
                      aria-label="Clear"
                      onClick={() => {
                        triggerHaptic('light');
                        setValue('');
                        inputRef.current?.focus();
                      }}
                      className="grid size-6 flex-none place-items-center rounded-full bg-white/[0.12] text-secondary hover:text-primary active:scale-90"
                    >
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={closeSheet}
                  className="h-[44px] flex-none rounded-full border border-white/[0.1] bg-white/[0.05] px-3.5 text-[13px] font-semibold text-secondary hover:text-primary active:scale-95"
                >
                  Cancel
                </button>
              </form>

              {/* Full-Width Scrollable Suggestions List */}
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pb-4">
                {value.trim().length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2.5 py-14 text-center">
                    <span
                      className="grid size-12 place-items-center rounded-full border border-white/[0.1] bg-white/[0.04]"
                      style={{ color: 'var(--accent-bright)' }}
                    >
                      <Sparkles size={20} />
                    </span>
                    <p className="text-[15px] font-semibold text-primary">Find your next track</p>
                    <p className="max-w-[260px] text-[12.5px] leading-relaxed text-secondary">
                      Type a song, artist, album, or mood to see instant matches across YouTube Music.
                    </p>
                  </div>
                ) : options.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => submitQuery(value)}
                    className="flex w-full items-center gap-3 rounded-[16px] border border-white/[0.09] bg-white/[0.04] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.08]"
                  >
                    <Search size={16} style={{ color: 'var(--accent-bright)' }} />
                    <span className="truncate text-[14.5px] font-semibold text-primary">
                      Search for “{value.trim()}”
                    </span>
                  </button>
                ) : (
                  <ul className="flex flex-col gap-1" role="listbox">
                    {options.map((option, idx) => {
                      if (option.kind === 'query') {
                        return (
                          <li key={`q-${option.text}-${idx}`} role="option" aria-selected={false}>
                            <button
                              type="button"
                              onClick={() => pickOption(option)}
                              className="flex min-h-[48px] w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99] active:bg-white/[0.09]"
                            >
                              <Search size={15} className="flex-none text-tertiary" />
                              <span className="min-w-0 flex-1 truncate text-[14.5px] text-secondary">
                                <span className="font-semibold text-primary">{option.typed}</span>
                                <span>{option.rest}</span>
                              </span>
                              <ArrowUpRight size={15} className="flex-none text-tertiary" />
                            </button>
                          </li>
                        );
                      }

                      const item = option.item;
                      const playable = item.kind === 'song' || item.kind === 'video';
                      const artistLine = item.artists.map((a) => a.name).join(', ') || item.subtitle || kindLabel(item.kind);
                      const cleanTitle = cleanTrackTitle(item.title, artistLine);
                      const isChecked = selecting && playable && selectedTracks.some((t) => t.videoId === item.id);

                      return (
                        <li key={`i-${item.id}-${idx}`} role="option" aria-selected={isChecked}>
                          <div
                            className="flex min-h-[60px] w-full items-center gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 transition-colors active:bg-white/[0.08]"
                            style={
                              isChecked
                                ? {
                                    borderColor: 'rgba(var(--accent-rgb), 0.55)',
                                    backgroundColor: 'rgba(var(--accent-rgb), 0.15)',
                                  }
                                : undefined
                            }
                          >
                            <button
                              type="button"
                              onClick={() => pickOption(option)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <div className="w-[46px] flex-none">
                                <Artwork
                                  src={item.thumbnail}
                                  displayWidth={46}
                                  radius={item.kind === 'artist' ? '50%' : '10px'}
                                />
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-[14.5px] font-semibold leading-tight text-primary">
                                  {cleanTitle}
                                </span>
                                <span className="mt-0.5 truncate text-[12px] text-secondary">{artistLine}</span>
                              </div>
                            </button>

                            {playable &&
                              (selecting ? (
                                <button
                                  type="button"
                                  onClick={() => toggleTrack(toTrack(item))}
                                  aria-label={isChecked ? `Deselect ${cleanTitle}` : `Select ${cleanTitle}`}
                                  className="grid size-6 flex-none place-items-center rounded-full border transition-all"
                                  style={
                                    isChecked
                                      ? {
                                          borderColor: 'var(--accent-hex)',
                                          backgroundColor: 'var(--accent-hex)',
                                          boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.5)',
                                        }
                                      : { borderColor: 'rgba(255,255,255,0.28)' }
                                  }
                                >
                                  {isChecked && <Check size={13} strokeWidth={3} className="text-white" />}
                                </button>
                              ) : (
                                <TrackMenu
                                  track={toTrack(item)}
                                  className="grid size-8 flex-none place-items-center rounded-full text-secondary hover:bg-white/[0.08] hover:text-primary"
                                />
                              ))}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
