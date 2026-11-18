import type { PokemonProfile } from "../../shared/pokemon/profile";

export type TypeClue = "correct" | "partial" | "wrong";
export type NumberClue = "correct" | "higher" | "lower";
export interface MysteryGuess {
  pokemon: PokemonProfile;
  matched: boolean;
  type1: TypeClue;
  type2: TypeClue;
  generation: NumberClue;
  height: NumberClue;
  weight: NumberClue;
}
