import shinyIds from "./shiny-sprites.json" with { type: "json" };

const shinySpecies = new Set<number>(shinyIds);

export const hasShinySprite = (id: number) => shinySpecies.has(id);

export function pokemonSprite(id: number, shiny?: boolean): string {
  const folder = shiny && hasShinySprite(id) ? "sprites/shiny/" : "sprites/";
  return `${import.meta.env.BASE_URL}${folder}${id}.png`;
}
