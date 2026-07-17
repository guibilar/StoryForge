import type { Entity as DomainEntity } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";
import { filterViewableNotes } from "../../../notes/graphql/guards";

export const Entity = {
  backlinks: async (
    entity: DomainEntity,
    _args: unknown,
    context: GraphQLContext,
  ) => {
    const notes = await context.noteService.listEntityBacklinks(
      entity.Id.toString(),
    );

    return filterViewableNotes(context, entity.CampaignId, notes);
  },
};
