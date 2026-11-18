/** Classic Pokémon type colors, used to badge type values in results. */
const TYPE_COLORS: Record<string, string> = {
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#F7D02C",
  grass: "#7AC74C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
  stellar: "#40B5A5",
};

/** Pick the higher-contrast text color using WCAG relative luminance. */
function badgeTextColor(hex: string): string {
  const channels = hex.slice(1).match(/../g)!.map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? "#000" : "#fff";
}

export function TypeBadge({ type }: { type: string }) {
  const color = Object.prototype.hasOwnProperty.call(TYPE_COLORS, type) ? TYPE_COLORS[type] : undefined;
  return color ? <span className="type-badge" style={{ backgroundColor: color, color: badgeTextColor(color) }}>{type}</span> : <span>{type}</span>;
}

export const isPokemonType = (value: string): boolean => Object.prototype.hasOwnProperty.call(TYPE_COLORS, value);
