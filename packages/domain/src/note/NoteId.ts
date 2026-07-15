import { Id } from "../shared/Id";

export type NoteId = Id<"Note">;

export const NoteId = {
  create: (): NoteId => Id.create<"Note">(),
  fromString: (value: string): NoteId => Id.fromString<"Note">(value),
};
