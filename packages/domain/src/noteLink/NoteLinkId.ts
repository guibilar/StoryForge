import { Id } from "../shared/Id";

export type NoteLinkId = Id<"NoteLink">;

export const NoteLinkId = {
  create: (): NoteLinkId => Id.create<"NoteLink">(),
  fromString: (value: string): NoteLinkId => Id.fromString<"NoteLink">(value),
};
