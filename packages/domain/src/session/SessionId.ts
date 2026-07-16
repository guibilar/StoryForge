import { Id } from "../shared/Id";

export type SessionId = Id<"Session">;

export const SessionId = {
  create: (): SessionId => Id.create<"Session">(),
  fromString: (value: string): SessionId => Id.fromString<"Session">(value),
};
