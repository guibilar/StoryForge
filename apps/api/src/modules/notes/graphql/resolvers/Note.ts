import type { Note as DomainNote } from "@storyforge/domain";

export const Note = {
  id: (note: DomainNote) => note.Id.toString(),
  campaignId: (note: DomainNote) => note.CampaignId,
  authorId: (note: DomainNote) => note.AuthorId.toString(),
  title: (note: DomainNote) => note.Title,
  content: (note: DomainNote) => note.Content,
  createdAt: (note: DomainNote) => note.CreatedAt.toISOString(),
  updatedAt: (note: DomainNote) => note.UpdatedAt.toISOString(),
  deletedAt: (note: DomainNote) => note.DeletedAt?.toISOString() ?? null,
};
