const icons = {
  book: { path: "M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15" },
  trophy: { path: "M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-4 2h8" },
  terminal: { path: "M4 4h16v16H4V4Zm3 4 3 3-3 3m5 1h5" },
  sparkle: { path: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" },
  table: { path: "M3 4h18v16H3V4Zm0 5h18M9 9v11m6-11v11M3 14h18" },
  history: { path: "M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2" },
  bookmark: { path: "M6 3h12v18l-6-4-6 4V3Z" },
  trainer: { file: "game-ui/trainer.png" },
  gear: { file: "game-ui/options.png" },
  compass: { file: "game-ui/town-map.png" },
  ball: { file: "game-ui/pokedex.png" },
  boxes: { file: "game-ui/pokemon.png" },
  bag: { file: "safari/bag.png" },
} as const;

export function NavigationIcon({ name }: { name: keyof typeof icons }) {
  const icon = icons[name];
  if ("file" in icon) return <img className="navigation-icon navigation-bag" src={`${import.meta.env.BASE_URL}${icon.file}`} alt="" width={20} height={20} aria-hidden="true" />;
  return <svg className="navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icon.path} /></svg>;
}
