import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Note } from "./resolvers/Note";
import { Entity } from "./resolvers/Entity";

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "schema");

function readTypeDefs(fileName: string): string {
  return readFileSync(join(schemaDir, fileName), "utf-8");
}

export const typeDefs = [readTypeDefs("NoteLink.graphql")];

export const resolvers = { Note, Entity };
