import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Query } from "./resolvers/Query";
import { Mutation } from "./resolvers/Mutation";
import { Note } from "./resolvers/Note";

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "schema");

function readTypeDefs(fileName: string): string {
  return readFileSync(join(schemaDir, fileName), "utf-8");
}

export const typeDefs = [
  readTypeDefs("Note.graphql"),
  readTypeDefs("Query.graphql"),
  readTypeDefs("Mutation.graphql"),
];

export const resolvers = { Query, Mutation, Note };
