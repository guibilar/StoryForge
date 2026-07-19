import { imageSize } from "image-size";
import { ValidationError } from "@storyforge/domain";

import type { GraphQLContext } from "../../../../graphql/context";
import type { UploadableFile } from "../../../entities/infrastructure/LocalImageStore";
import { toGraphQLError } from "../../../../graphql/errors";
import {
  requireCampaignBroadcaster,
  requireCampaignWriter,
} from "../../../campaignMembers/graphql/guards";
import { resolveViewportSyncTargets } from "../../application/ViewportSyncTargetResolver";

export interface CreateMarkerInput {
  campaignId: string;
  entityId?: string | null;
  name: string;
  lat: number;
  lng: number;
  description?: string | null;
}

export interface UpdateMarkerInput {
  id: string;
  entityId?: string | null;
  name?: string;
  lat?: number;
  lng?: number;
  description?: string | null;
}

export interface CreateTerritoryInput {
  campaignId: string;
  entityId?: string | null;
  name: string;
  type: string;
  geometry: string;
  description?: string | null;
}

export interface UpdateTerritoryInput {
  id: string;
  entityId?: string | null;
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

export interface ForceSyncViewportInput {
  campaignId: string;
  center: { lat: number; lng: number };
  zoom: number;
  target: { allPlayers: boolean; userIds: string[] };
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

  uploadMapImage: async (
    _parent: unknown,
    args: { campaignId: string; file: File },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignWriter(context, args.campaignId);

      // Read the upload stream exactly once, then hand callers a
      // replayable in-memory view of it — LocalImageStore.save() also
      // calls file.arrayBuffer() internally, and a graphql-yoga Upload's
      // underlying stream can't be read twice.
      const arrayBuffer = await args.file.arrayBuffer();
      let dimensions: { width?: number; height?: number };
      try {
        dimensions = imageSize(new Uint8Array(arrayBuffer));
      } catch {
        throw new ValidationError("Unable to read the image's dimensions.");
      }
      if (!dimensions.width || !dimensions.height) {
        throw new ValidationError("Unable to read the image's dimensions.");
      }

      const bufferedFile: UploadableFile = {
        name: args.file.name,
        type: args.file.type,
        arrayBuffer: async () => arrayBuffer,
      };
      const url = await context.imageStorage.save(
        args.campaignId,
        bufferedFile,
      );

      return await context.mapImageService.uploadMapImage({
        campaignId: args.campaignId,
        url,
        fileName: args.file.name,
        mimeType: args.file.type,
        sizeBytes: args.file.size,
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch (error) {
      toGraphQLError(error);
    }
  },

  deleteMapImage: async (
    _parent: unknown,
    args: { campaignId: string },
    context: GraphQLContext,
  ) => {
    try {
      await requireCampaignWriter(context, args.campaignId);
      await context.mapImageService.deleteMapImage(args.campaignId);
      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },

  forceSyncViewport: async (
    _parent: unknown,
    args: { input: ForceSyncViewportInput },
    context: GraphQLContext,
  ) => {
    try {
      const broadcaster = await requireCampaignBroadcaster(
        context,
        args.input.campaignId,
      );
      const members = await context.campaignMemberService.listMembers(
        args.input.campaignId,
      );
      const targetUserIds = resolveViewportSyncTargets(
        members,
        args.input.target,
      );

      context.pubSub.publish("forceSyncViewport", args.input.campaignId, {
        campaignId: args.input.campaignId,
        center: args.input.center,
        zoom: args.input.zoom,
        broadcasterId: broadcaster.UserId.toString(),
        targetUserIds,
      });

      return true;
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
