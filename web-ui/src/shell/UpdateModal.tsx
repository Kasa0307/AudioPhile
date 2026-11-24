import { Download, Loader2, ShieldAlert, Sparkles, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUpdater } from '@/state/updater';

/**
 * Acoustic Glass In-App OTA Update Modal:
 * Displays version upgrade badge, bulleted changelogs, live APK download progress bar,
 * and automatic one-tap redirect to Android's "Install unknown apps" permission toggle when needed.
 */
export function UpdateModal() {
  const modalOpen = useUpdater((s) => s.modalOpen);
  const available = useUpdater((s) => s.available);
  const currentName = useUpdater((s) => s.currentName);
  const phase = useUpdater((s) => s.phase);
  const progress = useUpdater((s) => s.progress);
  const detail = useUpdater((s) => s.detail);
  const error = useUpdater((s) => s.error);
  const { startInstall, openPermissionSettings, dismissModal } = useUpdater.getState();

  // Check silently once on startup (2.5s after launch so initial audio & UI load stay instant)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void useUpdater.getState().checkForUpdates(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  if (!modalOpen || !available) return null;

  const isBusy = phase === 'downloading' || phase === 'installing';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Update Available"
      className="fixed inset-0 z-[10075] flex items-end justify-center bg-black/72 p-3 backdrop-blur-md sm:items-center"
      onClick={() => {
        if (!isBusy) dismissModal();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up relative flex max-h-[85dvh] w-full max-w-[440px] flex-col overflow-hidden rounded-[28px] border border-white/[0.14] bg-[#0b101d]/97 p-5 shadow-[0_24px_68px_rgba(0,0,0,0.85)] backdrop-blur-3xl"
        style={{
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
          backgroundImage:
            'radial-gradient(ellipse 90% 42% at 50% 0%, rgba(var(--accent-rgb), 0.25) 0%, transparent 72%)',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 flex-none place-items-center rounded-[14px] border border-white/[0.14]"
              style={{
                backgroundColor: 'rgba(var(--accent-rgb), 0.2)',
                color: 'var(--accent-bright)',
                boxShadow: '0 0 22px rgba(var(--accent-rgb), 0.35)',
              }}
            >
              <Sparkles size={20} />
            </span>
            <div className="flex flex-col">
              <h2 className="text-[18px] font-bold leading-tight text-primary">Update Available</h2>
              <div className="mt-1 flex items-center gap-2 font-mono text-[11px] font-semibold">
                <span className="text-tertiary">v{currentName}</span>
                <span className="text-tertiary">→</span>
                <span style={{ color: 'var(--accent-bright)' }}>v{available.versionName}</span>
                {available.releaseDate && (
                  <span className="text-tertiary">· {available.releaseDate}</span>
                )}
              </div>
            </div>
          </div>

          {!isBusy && (
            <button
              type="button"
              onClick={dismissModal}
              aria-label="Close"
              className="grid size-8 flex-none place-items-center rounded-full bg-white/[0.08] text-secondary hover:text-primary active:scale-90"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Changelogs List */}
        {available.changelogs.length > 0 && (
          <div className="no-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-3.5">
            <span className="mb-2 block text-[12px] font-semibold text-secondary">What’s New</span>
            <ul className="flex flex-col gap-2">
              {available.changelogs.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-primary">
                  <span
                    className="mt-1.5 size-1.5 flex-none rounded-full"
                    style={{ backgroundColor: 'var(--accent-bright)' }}
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Permission Required Notice (Android Install Unknown Apps) */}
        {phase === 'permission_needed' && (
          <div className="mt-3.5 flex items-start gap-2.5 rounded-[16px] border border-amber-400/30 bg-amber-400/10 p-3 text-[12.5px] leading-relaxed text-amber-200">
            <ShieldAlert size={16} className="mt-0.5 flex-none text-amber-300" />
            <div className="flex flex-col gap-1.5">
              <span>Allow <strong>Install unknown apps</strong> for Audiophile in Settings, then return here and tap <strong>Update Now</strong>.</span>
              <button
                type="button"
                onClick={openPermissionSettings}
                className="w-fit rounded-full border border-amber-300/35 bg-amber-300/15 px-3 py-1 text-[11.5px] font-semibold text-amber-100 active:scale-95"
              >
                Open Permission Settings
              </button>
            </div>
          </div>
        )}

        {/* Live Download Progress Bar */}
        {(phase === 'downloading' || phase === 'installing') && (
          <div className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between font-mono text-[11px] font-semibold">
              <span className="text-secondary">{detail || 'Downloading update…'}</span>
              <span style={{ color: 'var(--accent-bright)' }}>{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${Math.max(4, progress)}%`,
                  background: 'linear-gradient(90deg, var(--accent-hex), var(--accent-bright))',
                  boxShadow: '0 0 12px rgba(var(--accent-rgb), 0.7)',
                }}
              />
            </div>
          </div>
        )}

        {/* Error notice */}
        {error && (
          <p className="mt-3 text-[12.5px] font-medium text-red-400">{error}</p>
        )}

        {/* Action Buttons */}
        <div className="mt-5 flex items-center gap-2.5">
          {!isBusy && (
            <button
              type="button"
              onClick={dismissModal}
              className="h-11 flex-1 rounded-full border border-white/[0.11] bg-white/[0.05] text-[13.5px] font-semibold text-secondary hover:text-primary active:scale-95"
            >
              Later
            </button>
          )}

          <button
            type="button"
            disabled={isBusy}
            onClick={startInstall}
            className="inline-flex h-11 flex-[1.5] items-center justify-center gap-2 rounded-full text-[14px] font-bold text-white transition-all active:scale-95 disabled:opacity-70"
            style={{
              backgroundColor: 'var(--accent-hex)',
              boxShadow: '0 8px 24px rgba(var(--accent-rgb), 0.42), inset 0 1px 0 rgba(255,255,255,0.24)',
            }}
          >
            {isBusy ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{phase === 'installing' ? 'Installing…' : `Downloading ${progress}%`}</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Update Now</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
