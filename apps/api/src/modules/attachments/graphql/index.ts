import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Mutation } from "./resolvers/Mutation";
import { Attachment } from "./resolvers/Attachment";
import { Note } from "./resolvers/Note";

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "schema");

function readTypeDefs(fileName: string): string {
  return readFileSync(join(schemaDir, fileName), "utf-8");
}

export const typeDefs = [
  readTypeDefs("Attachment.graphql"),
  readTypeDefs("Mutation.graphql"),
];

export const resolvers = { Mutation, Attachment, Note };
