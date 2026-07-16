import { Id } from "../shared/Id";

export type EventId = Id<"Event">;

export const EventId = {
  create: (): EventId => Id.create<"Event">(),
  fromString: (value: string): EventId => Id.fromString<"Event">(value),
};
