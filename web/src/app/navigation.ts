export const NAVIGATION = [
  { caption: "Menu", items: [
    { id: "safari", label: "Explore", icon: "compass" },
    { id: "pokedex", label: "My Pokédex", icon: "ball" },
    { id: "pc", label: "PC Boxes", icon: "boxes" },
    { id: "bag", label: "Bag", icon: "bag" },
    { id: "profiles", label: "Trainer ID", icon: "trainer" },
    { id: "settings", label: "Options", icon: "gear" },
  ] },
  { caption: "Practice", items: [
    { id: "mystery", label: "Who’s That Pokémon?", icon: "sparkle" },
    { id: "get-started", label: "Get started", icon: "book" },
    { id: "challenges", label: "Challenges", icon: "trophy" },
    { id: "workspace", label: "Free practice", icon: "terminal" },
  ] },
  { caption: "Your workspace", items: [
    { id: "schema", label: "Schema & guide", icon: "table" },
    { id: "history", label: "History", icon: "history" },
    { id: "saved", label: "Saved", icon: "bookmark" },
  ] },
] as const;
export type NavigationId = typeof NAVIGATION[number]["items"][number]["id"];
export type WorkspaceView = Exclude<NavigationId, "mystery">;
