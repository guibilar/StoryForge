import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";
import type {
  CreateEntityDto,
  UpdateEntityDto,
} from "../../application/EntityService";

export const Mutation = {
  createEntity: async (
    _parent: unknown,
    args: { input: CreateEntityDto },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.input.campaignId);
      return await context.entityService.createEntity(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateEntity: async (
    _parent: unknown,
    args: { input: UpdateEntityDto },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.input.id);
      await requireCampaignMember(context, entity.CampaignId);
      return await context.entityService.updateEntity(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteEntity: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.id);
      await requireCampaignMember(context, entity.CampaignId);
      await context.entityService.deleteEntity(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  uploadEntityImage: async (
    _parent: unknown,
    args: { entityId: string; file: File },
    context: GraphQLContext,
  ) => {
    try {
      requireCurrentUser(context);
      const entity = await context.entityService.getEntity(args.entityId);
      await requireCampaignMember(context, entity.CampaignId);
      const path = await context.imageStorage.save(args.entityId, args.file);

      return await context.entityService.setEntityImage(args.entityId, path);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
