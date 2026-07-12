import { Id } from "../shared/Id";

export type TagId = Id<"Tag">;

export const TagId = {
  create: (): TagId => Id.create<"Tag">(),
  fromString: (value: string): TagId => Id.fromString<"Tag">(value),
};
