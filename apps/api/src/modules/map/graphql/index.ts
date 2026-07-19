import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Query } from "./resolvers/Query";
import { Mutation } from "./resolvers/Mutation";
import { Subscription } from "./resolvers/Subscription";
import { Marker } from "./resolvers/Marker";
import { Territory } from "./resolvers/Territory";
import { MapImage } from "./resolvers/MapImage";

const schemaDir = join(dirname(fileURLToPath(import.meta.url)), "schema");

function readTypeDefs(fileName: string): string {
  return readFileSync(join(schemaDir, fileName), "utf-8");
}

export const typeDefs = [
  readTypeDefs("Marker.graphql"),
  readTypeDefs("Territory.graphql"),
  readTypeDefs("MapImage.graphql"),
  readTypeDefs("ForceSyncViewport.graphql"),
  readTypeDefs("Query.graphql"),
  readTypeDefs("Mutation.graphql"),
  readTypeDefs("Subscription.graphql"),
];

export const resolvers = {
  Query,
  Mutation,
  Subscription,
  Marker,
  Territory,
  MapImage,
};
