const paths = {
  book: "M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15",
  trophy: "M8 3h8v6a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-4 2h8",
  terminal: "M4 4h16v16H4V4Zm3 4 3 3-3 3m5 1h5",
  sparkle: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  compass: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-6-3-2 4-4 2 2-4 4-2Z",
  ball: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM3 12h6m6 0h6m-6 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  table: "M3 4h18v16H3V4Zm0 5h18M9 9v11m6-11v11M3 14h18",
  history: "M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2",
  bookmark: "M6 3h12v18l-6-4-6 4V3Z",
  boxes: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
} as const;

export function NavigationIcon({ name }: { name: keyof typeof paths }) {
  return <svg className="navigation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
