import { Settings } from 'lucide-react';
import { PrefetchLink, PrefetchNavLink } from '@/components/PrefetchLink';
import {
  AlbumsIcon,
  AllPlaylistsIcon,
  ArtistsIcon,
  HomeIcon,
  MadeForYouIcon,
  NewIcon,
  RecentlyAddedIcon,
  SearchIcon,
  SongsIcon,
  type NavIconProps,
} from '@/components/icons/NavIcons';
import { LIBRARY_SECTIONS } from '@/data/music/library';
import { useSignedIn } from '@/data/music/queries';

interface NavItem {
  to: string;
  label: string;
  Icon: (props: NavIconProps) => React.ReactNode;
}

const PRIMARY: NavItem[] = [
  { to: '/home', label: 'Home', Icon: HomeIcon },
  { to: '/new', label: 'Explore', Icon: NewIcon },
  { to: '/search', label: 'Search', Icon: SearchIcon },
];

const LIBRARY_PILLS: NavItem[] = [
  { to: '/library/playlists', label: 'Playlists', Icon: AllPlaylistsIcon },
  { to: '/library/songs', label: 'Liked', Icon: SongsIcon },
  { to: '/library/recent', label: 'Recent', Icon: RecentlyAddedIcon },
  { to: '/library/artists', label: 'Artists', Icon: ArtistsIcon },
  { to: '/library/albums', label: 'Albums', Icon: AlbumsIcon },
  { to: '/library/made-for-you', label: LIBRARY_SECTIONS['made-for-you'].title, Icon: MadeForYouIcon },
];

const pillLink =
  'group inline-flex h-9 items-center gap-2 rounded-pill px-4 text-[13px] font-semibold tracking-[0.01em] text-[#d8e4ff]/85 transition-all duration-150 hover:bg-white/[0.08] hover:text-white aria-[current=page]:bg-key-bg/95 aria-[current=page]:text-white aria-[current=page]:shadow-[0_4px_18px_rgba(75,114,230,0.35)] max-sm:h-7 max-sm:px-2.5 max-sm:text-[12px]';

const compactLibraryLink =
  'group inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-[12.5px] font-medium text-[#d8e4ff]/80 transition-all duration-150 hover:bg-white/[0.08] hover:text-white aria-[current=page]:bg-key/25 aria-[current=page]:text-white max-sm:h-7 max-sm:px-2 max-sm:text-[11px]';

/**
 * Unified Horizontal Command Bar across desktop and phone viewports in
 * Midnight Blue Glassmorphism.
 */
export function Sidebar() {
  const signedIn = useSignedIn();

  return (
    <header
      className="relative z-(--z-web-chrome) flex h-16 flex-none items-center justify-between gap-4 border-b border-white/[0.08] bg-[#0b1325]/55 px-6 shadow-[0_8px_32px_rgba(3,7,18,0.45)] backdrop-blur-2xl max-sm:h-[calc(48px+env(safe-area-inset-top))] max-sm:justify-center max-sm:px-4 max-sm:pt-[env(safe-area-inset-top)]"
      aria-label="Main"
    >
      <PrefetchLink to="/home" className="inline-flex flex-none items-center rounded-pill pr-2 max-sm:pr-0" aria-label="Audiophile, Home">
        <span className="type-[700_18px/22px] tracking-[-0.01em] text-primary max-sm:text-[16px]">Audiophile</span>
      </PrefetchLink>

      <nav className="flex min-w-0 items-center gap-1.5 overflow-x-auto rounded-pill border border-white/[0.1] bg-white/[0.04] px-1.5 py-1 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:hidden">
        {PRIMARY.map(({ to, label, Icon }) => (
          <PrefetchNavLink key={to} to={to} className={pillLink}>
            <Icon size={17} className="flex-none" />
            <span className="whitespace-nowrap">{label}</span>
          </PrefetchNavLink>
        ))}
        {signedIn && (
          <>
            <span className="mx-1 h-4 w-px flex-none bg-white/12" aria-hidden="true" />
            {LIBRARY_PILLS.slice(0, 5).map(({ to, label, Icon }) => (
              <PrefetchNavLink key={to} to={to} className={compactLibraryLink}>
                <Icon size={15} className="flex-none" />
                <span className="whitespace-nowrap">{label}</span>
              </PrefetchNavLink>
            ))}
          </>
        )}
      </nav>

      <PrefetchNavLink
        to="/settings"
        aria-label="Settings"
        className="inline-flex h-9 flex-none items-center gap-2 rounded-pill border border-white/[0.12] bg-white/[0.05] px-4 type-callout-emphasized text-primary backdrop-blur-md transition-colors hover:border-key/40 hover:bg-white/[0.1] aria-[current=page]:border-key aria-[current=page]:bg-key-bg/90 aria-[current=page]:text-white aria-[current=page]:shadow-[0_4px_18px_rgba(75,114,230,0.32)] max-sm:hidden"
      >
        <Settings size={15} strokeWidth={2} />
        <span>Settings</span>
      </PrefetchNavLink>
    </header>
  );
}
