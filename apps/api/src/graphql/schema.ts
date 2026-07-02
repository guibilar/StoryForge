import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createSchema } from "graphql-yoga";

import {
  typeDefs as entityTypeDefs,
  resolvers as entityResolvers,
} from "../modules/entities/graphql";

const rootTypeDefs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "schema", "Root.graphql"),
  "utf-8",
);

export const schema = createSchema({
  typeDefs: [rootTypeDefs, ...entityTypeDefs],
  resolvers: [entityResolvers],
});
