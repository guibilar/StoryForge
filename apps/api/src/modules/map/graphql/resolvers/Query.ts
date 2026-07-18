import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export const Query = {
  marker: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      const marker = await context.markerService.getMarker(args.id);
      await requireCampaignMember(context, marker.CampaignId);
      return marker;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  markers: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.campaignId);
      return await context.markerService.listMarkers(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  territory: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      const territory = await context.territoryService.getTerritory(args.id);
      await requireCampaignMember(context, territory.CampaignId);
      return territory;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  territories: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.campaignId);
      return await context.territoryService.listTerritories(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  mapImage: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignMember(context, args.campaignId);
      return await context.mapImageService.getMapImage(args.campaignId);
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
