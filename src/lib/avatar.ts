// Shared initials + deterministic colour for athlete/person avatars, so every list (home
// "Deine Stars", matchday card, favourites, …) draws the same coloured-monogram avatar
// without needing photo rights.

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h}, 42%, 36%)`;
}
