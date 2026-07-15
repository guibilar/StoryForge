import type { Entity as DomainEntity } from "@storyforge/domain";
import type { GraphQLContext } from "../../../../graphql/context";

export const Entity = {
  backlinks: (entity: DomainEntity, _args: unknown, context: GraphQLContext) =>
    context.noteService.listEntityBacklinks(entity.Id.toString()),
};
