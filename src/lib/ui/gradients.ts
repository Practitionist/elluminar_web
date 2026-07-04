/**
 * Deterministic gradient thumbnails.
 *
 * Course/Project `thumbnailAssetId` is a soft ref to `MediaAsset` (no FK), so
 * resolving a real image needs a join. The Pramaan cards use gradient tiles
 * instead of photos — we mirror that and pick a stable gradient from the
 * item's title/slug, so the same item always renders the same tile with no
 * DB round-trip.
 */

export const THUMB_GRADIENTS_LIGHT = [
  "linear-gradient(135deg, #DCD2FB, #EFEBFF)", // violet
  "linear-gradient(135deg, #BBD8FF, #EAF2FF)", // blue
  "linear-gradient(135deg, #BFE8D2, #E9F8EF)", // green
  "linear-gradient(135deg, #F7C6DC, #FDEFF5)", // pink
  "linear-gradient(135deg, #FFE7C4, #FFF4E3)", // amber
  "linear-gradient(135deg, #C9BBF7, #DCD2FB)", // deep violet
] as const;

export const THUMB_GRADIENTS_DARK = [
  "linear-gradient(135deg, #2A2440, #191B1F)", // ink violet
  "linear-gradient(135deg, #0E4429, #1FA45B)", // ink green
  "linear-gradient(135deg, #1D2B53, #3E63DD)", // ink blue
  "linear-gradient(135deg, #3A1D3D, #8E3B8A)", // ink magenta
] as const;

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function gradientForKey(
  key: string,
  variant: "light" | "dark" = "light",
): string {
  const palette =
    variant === "dark" ? THUMB_GRADIENTS_DARK : THUMB_GRADIENTS_LIGHT;
  return palette[hash(key) % palette.length];
}
