export interface PokemonProfile {
  id: number;
  name: string;
  type1: string;
  type2: string | null;
  generationId: number;
  heightM: number;
  weightKg: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const isPositiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const isMeasurement = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

export function isPokemonProfile(value: unknown): value is PokemonProfile {
  return isRecord(value) && isPositiveInteger(value.id) && typeof value.name === "string" && typeof value.type1 === "string"
    && (value.type2 === null || typeof value.type2 === "string") && isPositiveInteger(value.generationId)
    && isMeasurement(value.heightM) && isMeasurement(value.weightKg);
}

