export interface TrainerIdentity { id: string; issuedAt: string }

export function createTrainerIdentity(): TrainerIdentity {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return { id: String(10000 + value % 90000), issuedAt: new Date().toISOString() };
}

export function isTrainerIdentity(value: unknown): value is TrainerIdentity {
  return !!value && typeof value === "object"
    && "id" in value && typeof value.id === "string" && /^\d{5}$/.test(value.id)
    && "issuedAt" in value && typeof value.issuedAt === "string"
    && Number.isFinite(Date.parse(value.issuedAt)) && new Date(value.issuedAt).toISOString() === value.issuedAt;
}
