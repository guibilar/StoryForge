import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Subscription } from "./resolvers/Subscription";

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "schema");

function readTypeDefs(fileName: string): string {
  return readFileSync(join(schemaDir, fileName), "utf-8");
}

export const typeDefs = [
  readTypeDefs("CampaignBroadcast.graphql"),
  readTypeDefs("Subscription.graphql"),
];

export const resolvers = { Subscription };
