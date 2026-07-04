import { Id } from "../shared/Id";

export type EntityId = Id<"Entity">;

export const EntityId = {
  create: (): EntityId => Id.create<"Entity">(),
  fromString: (value: string): EntityId => Id.fromString<"Entity">(value),
};
