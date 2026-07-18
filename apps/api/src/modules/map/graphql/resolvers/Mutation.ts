import { ValidationError } from "@storyforge/domain";

import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCampaignWriter } from "../../../campaignMembers/graphql/guards";

export interface CreateMarkerInput {
  campaignId: string;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
}

export interface UpdateMarkerInput {
  id: string;
  name?: string;
  lat?: number;
  lng?: number;
  description?: string | null;
}

export interface CreateTerritoryInput {
  campaignId: string;
  name: string;
  type: string;
  geometry: string;
  description?: string | null;
}

export interface UpdateTerritoryInput {
  id: string;
  name?: string;
  type?: string;
  geometry?: string;
  description?: string | null;
}

// geometry travels the wire as a JSON-encoded string (see Territory.graphql
// — no custom scalars in this schema), so it needs parsing at this boundary,
// same as workspace/graphql/resolvers/Mutation.ts does for layout.
function parseGeometry(value: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new ValidationError('"geometry" is not valid JSON.');
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError('"geometry" must be a JSON object.');
  }

  return parsed as Record<string, unknown>;
}

export const Mutation = {
  createMarker: async (
    _parent: unknown,
    args: { input: CreateMarkerInput },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignWriter(context, args.input.campaignId);
      return await context.markerService.createMarker(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateMarker: async (
    _parent: unknown,
    args: { input: UpdateMarkerInput },
    context: GraphQLContext,
  ) => {
    try {
      const marker = await context.markerService.getMarker(args.input.id);
      await requireCampaignWriter(context, marker.CampaignId);
      return await context.markerService.updateMarker(args.input);
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteMarker: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      const marker = await context.markerService.getMarker(args.id);
      await requireCampaignWriter(context, marker.CampaignId);
      await context.markerService.deleteMarker(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  createTerritory: async (
    _parent: unknown,
    args: { input: CreateTerritoryInput },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignWriter(context, args.input.campaignId);
      return await context.territoryService.createTerritory({
        ...args.input,
        geometry: parseGeometry(args.input.geometry),
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  updateTerritory: async (
    _parent: unknown,
    args: { input: UpdateTerritoryInput },
    context: GraphQLContext,
  ) => {
    try {
      const territory = await context.territoryService.getTerritory(
        args.input.id,
      );
      await requireCampaignWriter(context, territory.CampaignId);
      return await context.territoryService.updateTerritory({
        ...args.input,
        geometry:
          args.input.geometry !== undefined
            ? parseGeometry(args.input.geometry)
            : undefined,
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteTerritory: async (
    _parent: unknown,
    args: { id: string },
    context: GraphQLContext,
  ) => {
    try {
      const territory = await context.territoryService.getTerritory(args.id);
      await requireCampaignWriter(context, territory.CampaignId);
      await context.territoryService.deleteTerritory(args.id);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
