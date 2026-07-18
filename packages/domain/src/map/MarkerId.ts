import { Id } from "../shared/Id";

export type MarkerId = Id<"Marker">;

export const MarkerId = {
  create: (): MarkerId => Id.create<"Marker">(),
  fromString: (value: string): MarkerId => Id.fromString<"Marker">(value),
};
