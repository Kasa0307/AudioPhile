import { Check, ListPlus, Music2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { sizedArtwork } from '@/lib/artwork';
import { useBatchSelect } from '@/state/batchSelect';

/**
 * Floating Batch-Selection Action Tray (sits cleanly above UnifiedSonicDock while
 * Multi-Select Mode is active on Home & Search) + Global Confirmation Toast.
 */
export function BatchSelectionBar() {
  const selecting = useBatchSelect((s) => s.selecting);
  const selectedTracks = useBatchSelect((s) => s.selectedTracks);
  const toast = useBatchSelect((s) => s.toast);
  const { stopSelecting, openPlaylistPicker } = useBatchSelect.getState();

  return (
    <>
      {selecting && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[9920] flex justify-center px-3"
          style={{
            bottom: 'calc(146px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div
            className="animate-sheet-up pointer-events-auto flex w-full max-w-[520px] items-center justify-between gap-2.5 rounded-full border bg-[#0e1526]/94 py-2 pr-2 pl-3 shadow-[0_14px_38px_rgba(0,0,0,0.72),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl"
            style={{ borderColor: 'rgba(var(--accent-rgb), 0.45)' }}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              {selectedTracks.length > 0 ? (
                <div className="flex flex-none -space-x-2">
                  {selectedTracks.slice(-3).map((t) => (
                    <div
                      key={t.videoId}
                      className="grid size-7 place-items-center overflow-hidden rounded-full border-2 border-[#0e1526] bg-[#162038]"
                    >
                      {t.thumbnail ? (
                        <img
                          src={sizedArtwork(t.thumbnail, 80)}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="size-full object-cover"
                        />
                      ) : (
                        <Music2 size={11} className="text-secondary" />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span
                  className="grid size-7 flex-none place-items-center rounded-full"
                  style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.2)', color: 'var(--accent-bright)' }}
                >
                  <Check size={14} />
                </span>
              )}

              <span className="truncate text-[13px] font-semibold text-primary">
                {selectedTracks.length > 0
                  ? `${selectedTracks.length} ${selectedTracks.length === 1 ? 'song' : 'songs'} selected`
                  : 'Tap songs to select'}
              </span>
            </div>

            <div className="flex flex-none items-center gap-1.5">
              <button
                type="button"
                onClick={stopSelecting}
                aria-label="Cancel selection"
                className="grid size-8 place-items-center rounded-full bg-white/[0.08] text-secondary hover:text-primary active:scale-90"
              >
                <X size={15} />
              </button>

              <button
                type="button"
                disabled={selectedTracks.length === 0}
                onClick={() => openPlaylistPicker(selectedTracks)}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-bold text-white transition-all active:scale-95 disabled:opacity-40"
                style={{
                  backgroundColor: 'var(--accent-hex)',
                  boxShadow:
                    selectedTracks.length > 0 ? '0 4px 16px rgba(var(--accent-rgb), 0.45)' : undefined,
                }}
              >
                <ListPlus size={14} />
                <span>Add to Playlist</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {toast &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 z-[10080] flex justify-center px-4"
            style={{
              top: 'max(64px, calc(var(--android-safe-top, 0px) + 56px), calc(env(safe-area-inset-top, 0px) + 56px))',
            }}
          >
            <div
              className="animate-sheet-up inline-flex items-center gap-2 rounded-full border bg-[#0f1729]/94 px-4 py-2 text-[13px] font-semibold text-white shadow-[0_12px_32px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
              style={{ borderColor: 'rgba(var(--accent-rgb), 0.48)' }}
            >
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: 'var(--accent-bright)', boxShadow: '0 0 8px rgba(var(--accent-rgb), 0.9)' }}
              />
              <span>{toast}</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
