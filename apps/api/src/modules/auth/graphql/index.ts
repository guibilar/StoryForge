import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Mutation } from "./resolvers/Mutation";
import { User } from "./resolvers/User";
import { Query } from "./resolvers/Query";

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "schema");

function readTypeDefs(fileName: string): string {
  return readFileSync(join(schemaDir, fileName), "utf-8");
}

export const typeDefs = [
  readTypeDefs("User.graphql"),
  readTypeDefs("Mutation.graphql"),
  readTypeDefs("Query.graphql"),
];

export const resolvers = { Mutation, User, Query };
