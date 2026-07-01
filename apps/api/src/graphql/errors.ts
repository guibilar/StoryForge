import { GraphQLError } from "graphql";
import { NotFoundError, ValidationError } from "@storyforge/domain";

export function toGraphQLError(error: unknown): never {
    if (error instanceof NotFoundError) {
        throw new GraphQLError(error.message, {
            extensions: { code: "NOT_FOUND" },
        });
    }

    if (error instanceof ValidationError) {
        throw new GraphQLError(error.message, {
            extensions: { code: "BAD_USER_INPUT" },
        });
    }

    throw error;
}