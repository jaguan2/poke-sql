import type { SafariSession } from "./types";

// Save compatibility only. Unova's world artwork and routes are no longer shipped.
const locations = new Set([
  "nuvema-town", "unova-route-1", "accumula-town", "unova-route-2", "striaton-city", "dreamyard",
  "unova-route-3", "wellspring-cave", "nacrene-city", "pinwheel-forest", "castelia-city",
  "unova-route-4", "desert-resort", "relic-castle", "nimbasa-city", "unova-route-5", "lostlorn-forest",
]);

export const isRetiredUnovaLocation = (id: unknown) => typeof id === "string" && locations.has(id);

/** Archive the original expedition once; remove only retired references from the live save. */
export function retireUnovaReferences(value: Record<string, unknown>, home: Pick<SafariSession, "zoneId" | "position" | "direction" | "layoutRevision">): Record<string, unknown> {
  const visiting = isRetiredUnovaLocation(value.zoneId);
  const visited = Array.isArray(value.visited) ? value.visited.filter(id => !isRetiredUnovaLocation(id)) : value.visited;
  const bookmarks = value.regionPositions;
  const hasBookmarks = !!bookmarks && typeof bookmarks === "object" && !Array.isArray(bookmarks);
  const hasUnovaBookmark = hasBookmarks && Object.prototype.hasOwnProperty.call(bookmarks, "unova");
  const hasVisits = Array.isArray(value.visited) && Array.isArray(visited) && visited.length !== value.visited.length;
  if (!visiting && !hasUnovaBookmark && !hasVisits) return value;
  return { ...value, retiredUnova: value.retiredUnova ?? value,
    ...(visiting ? { zoneId: home.zoneId, position: home.position, direction: home.direction,
      layoutRevision: home.layoutRevision, grassSteps: 0, encounter: null } : {}),
    ...(value.visited !== undefined ? { visited } : {}),
    ...(hasUnovaBookmark ? { regionPositions: Object.fromEntries(Object.entries(bookmarks).filter(([id]) => id !== "unova")) } : {}),
  };
}
