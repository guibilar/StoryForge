import {
  EntityId,
  EntityRepository,
  NoteId,
  NoteRepository,
} from "@storyforge/domain";

import type { ParsedNoteLink } from "./NoteLinkParser";

export interface ResolvedNoteLinkTarget {
  targetEntityId?: string;
  targetNoteId?: string;
}

/**
 * Resolves parsed `[[Label]]` references against real Entities/Notes in the
 * same campaign. Unresolvable links (no match, ambiguous title, or an
 * explicit id from another campaign) are dropped rather than persisted —
 * see KAN-45's "persists resolvable links" definition of done.
 */
export class NoteLinkResolver {
  constructor(
    private readonly entityRepository: EntityRepository,
    private readonly noteRepository: NoteRepository,
  ) {}

  async resolve(
    campaignId: string,
    parsedLinks: ParsedNoteLink[],
  ): Promise<ResolvedNoteLinkTarget[]> {
    const resolved = new Map<string, ResolvedNoteLinkTarget>();

    for (const link of parsedLinks) {
      const target = await this.resolveOne(campaignId, link);

      if (!target) {
        continue;
      }

      const key = target.targetEntityId
        ? `entity:${target.targetEntityId}`
        : `note:${target.targetNoteId}`;

      resolved.set(key, target);
    }

    return [...resolved.values()];
  }

  private async resolveOne(
    campaignId: string,
    link: ParsedNoteLink,
  ): Promise<ResolvedNoteLinkTarget | null> {
    if (link.explicitTargetType === "entity" && link.explicitTargetId) {
      const entity = await this.entityRepository.findById(
        EntityId.fromString(link.explicitTargetId),
      );

      return entity && entity.CampaignId === campaignId
        ? { targetEntityId: entity.Id.toString() }
        : null;
    }

    if (link.explicitTargetType === "note" && link.explicitTargetId) {
      const note = await this.noteRepository.findById(
        NoteId.fromString(link.explicitTargetId),
      );

      return note && note.CampaignId === campaignId
        ? { targetNoteId: note.Id.toString() }
        : null;
    }

    const entity = await this.entityRepository.findByName(
      campaignId,
      link.label,
    );

    if (entity) {
      return { targetEntityId: entity.Id.toString() };
    }

    const notes = await this.noteRepository.findByTitle(campaignId, link.label);

    return notes.length === 1 ? { targetNoteId: notes[0].Id.toString() } : null;
  }
}
