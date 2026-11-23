const NOISE_SUFFIX_RE =
  /\s*[\(\[](?:official\s*(?:audio|music\s*video|video|lyric\s*video|visualizer|track|hd|4k)?|lyric\s*video|lyrics?|audio\s*only|audio|visualizer|m\/v|mv|hd|4k|hq|remastered\s*\d*)[\)\]]\s*$/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strips redundant artist prefixes/suffixes ("Sunsetz – Cigarettes After Sex" -> "Sunsetz")
 * and YouTube video noise ("(Official Audio)", "(Official Video)") when the artist is
 * already shown on its own line.
 */
export function cleanTrackTitle(rawTitle: string, artistName?: string | null): string {
  let title = rawTitle.trim();
  if (!title) return title;

  // Strip repeated trailing "(Official Audio)", "[Official Video]", etc.
  let prev = '';
  while (title !== prev) {
    prev = title;
    title = title.replace(NOISE_SUFFIX_RE, '').trim();
  }

  const artist = artistName?.replace(/\s*-\s*Topic$/i, '').trim();
  if (artist && artist.length >= 2) {
    const esc = escapeRegex(artist);
    const suffixRe = new RegExp(`\\s+[-–—|]\\s+${esc}$`, 'i');
    const prefixRe = new RegExp(`^${esc}\\s+[-–—|]\\s+`, 'i');
    if (suffixRe.test(title)) {
      title = title.replace(suffixRe, '').trim();
    } else if (prefixRe.test(title)) {
      title = title.replace(prefixRe, '').trim();
    }
  }

  // Strip any trailing "(Official Audio)" that sat before "- Artist"
  prev = '';
  while (title !== prev) {
    prev = title;
    title = title.replace(NOISE_SUFFIX_RE, '').trim();
  }

  return title || rawTitle.trim();
}
