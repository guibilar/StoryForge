import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Mutation } from "./resolvers/Mutation";
import { CampaignMember } from "./resolvers/CampaignMember";

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "schema");

function readTypeDefs(fileName: string): string {
  return readFileSync(join(schemaDir, fileName), "utf-8");
}

export const typeDefs = [
  readTypeDefs("CampaignMember.graphql"),
  readTypeDefs("Mutation.graphql"),
];

export const resolvers = { Mutation, CampaignMember };
