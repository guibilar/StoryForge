import { Id } from "../shared/Id";

export type TerritoryId = Id<"Territory">;

export const TerritoryId = {
  create: (): TerritoryId => Id.create<"Territory">(),
  fromString: (value: string): TerritoryId => Id.fromString<"Territory">(value),
};
