import {
  ChevronRight,
  ListChecks,
  ListEnd,
  ListPlus,
  ListStart,
  MoreHorizontal,
  Music2,
  Star,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import type { MenuPlacement } from '@/components/Menu';
import { useLikeStatus, useSetLiked, useSignedIn } from '@/data/music/queries';
import type { Track } from '@/data/music/types';
import { sizedArtwork } from '@/lib/artwork';
import { cleanTrackTitle } from '@/lib/cleanTitle';
import { triggerHaptic } from '@/lib/haptics';
import { useBatchSelect } from '@/state/batchSelect';
import { usePlayer } from '@/state/player';
import { useUi } from '@/state/ui';

function SheetActionRow({
  icon,
  label,
  detail,
  trailing,
  accent,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  trailing?: React.ReactNode;
  accent?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex min-h-[56px] w-full items-center gap-3.5 rounded-[16px] px-3.5 py-2.5 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.985] active:bg-white/[0.09] disabled:opacity-45"
    >
      <span
        className="grid size-10 flex-none place-items-center rounded-[13px] border border-white/[0.09] bg-white/[0.05]"
        style={
          accent
            ? {
                color: 'var(--accent-bright)',
                borderColor: 'rgba(var(--accent-rgb), 0.38)',
                backgroundColor: 'rgba(var(--accent-rgb), 0.16)',
              }
            : { color: 'var(--systemPrimary)' }
        }
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-semibold leading-tight text-primary">{label}</span>
        {detail && <span className="mt-0.5 text-[12px] text-secondary">{detail}</span>}
      </div>
      {trailing && <span className="flex-none text-tertiary">{trailing}</span>}
    </button>
  );
}

function TrackActionSheet({ track, onClose }: { track: Track; onClose: () => void }) {
  const signedIn = useSignedIn();
  const status = useLikeStatus(signedIn ? track.videoId : null);
  const setLiked = useSetLiked();
  const liked = status.data === 'LIKE';
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const swipeStartY = useRef<number | null>(null);

  const artistLine = track.artists.map((a) => a.name).filter(Boolean).join(', ') || 'Audiophile';
  const displayTitle = cleanTrackTitle(track.title, artistLine);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    useUi.getState().setActiveMenuClose(onClose);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (useUi.getState().activeMenuClose === onClose) {
        useUi.getState().setActiveMenuClose(null);
      }
    };
  }, [onClose]);

  const { playNext, addToQueue } = usePlayer.getState();
  const { openPlaylistPicker, startSelecting, showToast } = useBatchSelect.getState();

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Options for ${displayTitle}`}
      className="fixed inset-0 z-[10050] flex items-end justify-center bg-black/62 backdrop-blur-md"
      onClick={onClose}
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
          if (y0 != null && y1 != null && y1 - y0 > 56) {
            triggerHaptic('light');
            onClose();
          }
        }}
        className="animate-sheet-up relative flex w-full max-w-[540px] flex-col overflow-hidden rounded-t-[28px] border-t border-x border-white/[0.12] bg-[#0b101d]/96 px-4 pt-2.5 shadow-[0_-20px_60px_rgba(0,0,0,0.75)] backdrop-blur-3xl"
        style={{
          paddingBottom: 'max(18px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
          backgroundImage:
            'radial-gradient(ellipse 85% 45% at 50% 0%, rgba(var(--accent-rgb), 0.2) 0%, transparent 72%)',
        }}
      >
        {/* Drag handle */}
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />

        {/* Track Preview Header */}
        <div className="mb-3 flex items-center gap-3.5 rounded-[18px] border border-white/[0.08] bg-white/[0.04] p-2.5">
          <div className="grid size-14 flex-none place-items-center overflow-hidden rounded-[12px] bg-[#141c2f] ring-1 ring-white/15">
            {track.thumbnail ? (
              <img
                src={sizedArtwork(track.thumbnail, 160)}
                alt={displayTitle}
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
            ) : (
              <Music2 size={20} className="text-secondary" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="line-clamp-2 text-[15.5px] font-bold leading-snug text-primary">{displayTitle}</span>
            <span className="mt-0.5 truncate text-[12.5px] font-medium text-secondary">{artistLine}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close options"
            className="grid size-8 flex-none place-items-center rounded-full bg-white/[0.07] text-secondary hover:text-primary active:scale-90"
          >
            <X size={16} />
          </button>
        </div>

        {/* Large Thumb-Friendly Action Rows */}
        <div className="flex flex-col gap-1">
          <SheetActionRow
            icon={<ListStart size={19} />}
            label="Play Next"
            detail="Queue right after the current song"
            onClick={() => {
              triggerHaptic('medium');
              playNext([track]);
              showToast('Playing next');
              onClose();
            }}
          />

          <SheetActionRow
            icon={<ListEnd size={19} />}
            label="Add to Queue"
            detail="Add to the end of Up Next"
            onClick={() => {
              triggerHaptic('light');
              addToQueue([track]);
              showToast('Added to queue');
              onClose();
            }}
          />

          {signedIn && (
            <>
              <div className="my-1 h-px bg-white/[0.07]" />

              <SheetActionRow
                icon={<Star size={19} fill={liked ? 'currentColor' : 'none'} />}
                label={liked ? 'Remove from Favorites' : 'Favorite'}
                detail={liked ? 'Saved in your Liked Music' : 'Save to your Liked Music'}
                accent={liked}
                disabled={status.isPending}
                onClick={() => {
                  triggerHaptic('medium');
                  setLiked.mutate({ videoId: track.videoId, liked: !liked });
                  showToast(liked ? 'Removed from Favorites' : 'Saved to Favorites');
                  onClose();
                }}
              />

              <SheetActionRow
                icon={<ListPlus size={19} />}
                label="Add to Playlists"
                detail="Pick one or multiple playlists at once"
                accent
                trailing={<ChevronRight size={18} />}
                onClick={() => {
                  triggerHaptic('light');
                  onClose();
                  openPlaylistPicker([track]);
                }}
              />

              <SheetActionRow
                icon={<ListChecks size={19} />}
                label="Select Multiple Songs"
                detail="Pick more tracks from Home or Search to add together"
                trailing={<ChevronRight size={18} />}
                onClick={() => {
                  onClose();
                  startSelecting(track);
                  useUi.setState({ mobileConsoleOpen: false, fullScreen: false });
                  if (!pathname.startsWith('/home') && !pathname.startsWith('/search')) {
                    navigate('/home');
                  }
                  showToast('Tap songs on Home or Search to select');
                }}
              />
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The ⋯ button (Lyrics/Now Playing, Cinema Stage Expand, Search, Track rows):
 * Opens a large, spacious Acoustic Glass slide-up bottom sheet from the bottom of the screen.
 */
export function TrackMenu({
  track,
  className,
  onOpenChange,
}: {
  track: Track;
  className?: string;
  placement?: MenuPlacement;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={`More options for ${track.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-open={open || undefined}
        onClick={(event) => {
          event.stopPropagation();
          triggerHaptic('light');
          setOpen(true);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal size={18} strokeWidth={2} />
      </button>
      {open && <TrackActionSheet track={track} onClose={close} />}
    </>
  );
}
