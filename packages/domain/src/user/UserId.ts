import { Id } from "../shared/Id";

export type UserId = Id<"User">;

export const UserId = {
  create: (): UserId => Id.create<"User">(),
  fromString: (value: string): UserId => Id.fromString<"User">(value),
};
