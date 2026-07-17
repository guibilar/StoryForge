import { ValidationError } from "@storyforge/domain";

import type { GraphQLContext } from "../../../../graphql/context";
import { toGraphQLError } from "../../../../graphql/errors";
import { requireCurrentUser } from "../../../auth/graphql/guards";
import { requireCampaignMember } from "../../../campaignMembers/graphql/guards";

export interface SaveWorkspaceStateInput {
  campaignId: string;
  layout: string;
  recentEntityIds: string;
}

function parseJsonField(fieldName: string, value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new ValidationError(`"${fieldName}" is not valid JSON.`);
  }
}

export const Mutation = {
  saveWorkspaceState: async (
    _parent: unknown,
    args: { input: SaveWorkspaceStateInput },
    context: GraphQLContext,
  ) => {
    try {
      const currentUser = requireCurrentUser(context);
      await requireCampaignMember(context, args.input.campaignId);

      const layout = parseJsonField("layout", args.input.layout);
      const recentEntityIds = parseJsonField(
        "recentEntityIds",
        args.input.recentEntityIds,
      );

      if (
        typeof layout !== "object" ||
        layout === null ||
        Array.isArray(layout)
      ) {
        throw new ValidationError('"layout" must be a JSON object.');
      }
      if (
        !Array.isArray(recentEntityIds) ||
        !recentEntityIds.every((id) => typeof id === "string")
      ) {
        throw new ValidationError(
          '"recentEntityIds" must be a JSON array of strings.',
        );
      }

      return await context.workspaceService.saveWorkspaceState(
        currentUser.Id.toString(),
        {
          campaignId: args.input.campaignId,
          layout: layout as Record<string, unknown>,
          recentEntityIds,
        },
      );
    } catch (error) {
      toGraphQLError(error);
    }
  },
};
