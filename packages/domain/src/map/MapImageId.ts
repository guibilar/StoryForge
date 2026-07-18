import { Id } from "../shared/Id";

export type MapImageId = Id<"MapImage">;

export const MapImageId = {
  create: (): MapImageId => Id.create<"MapImage">(),
  fromString: (value: string): MapImageId => Id.fromString<"MapImage">(value),
};
