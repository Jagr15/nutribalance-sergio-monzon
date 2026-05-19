export type GlobalInterface = object;
export const TipoUnidad = {
  KG: "KG",
  LT: "LT",
  TON: "TON",
} as const;
export type TipoUnidad = (typeof TipoUnidad)[keyof typeof TipoUnidad];
