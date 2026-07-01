import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";

export const Query = {
    entity: async (
        _parent: unknown,
        args: { id: string },
        context: GraphQLContext,
    ) => {
        try {
            return await context.entityService.getEntity(args.id);
        } catch (error) {
            toGraphQLError(error);
        }
    },

    entities: async (
        _parent: unknown,
        args: { campaignId: string },
        context: GraphQLContext,
    ) => {
        try {
            return await context.entityService.listEntities(args.campaignId);
        } catch (error) {
            toGraphQLError(error);
        }
    },
};