import { Id } from "../shared/Id";

export type RelationshipId = Id<"Relationship">;

export const RelationshipId = {
  create: (): RelationshipId => Id.create<"Relationship">(),
  fromString: (value: string): RelationshipId =>
    Id.fromString<"Relationship">(value),
};
