import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { createSchema } from "graphql-yoga";

import {
  typeDefs as entityTypeDefs,
  resolvers as entityResolvers,
} from "../modules/entities/graphql";
import {
  typeDefs as authTypeDefs,
  resolvers as authResolvers,
} from "../modules/auth/graphql";
import {
  typeDefs as campTypeDefs,
  resolvers as campResolvers,
} from "../modules/campaigns/graphql";
import {
  typeDefs as tagTypeDefs,
  resolvers as tagResolvers,
} from "../modules/tags/graphql";
import {
  typeDefs as relationshipTypeDefs,
  resolvers as relationshipResolvers,
} from "../modules/relationships/graphql";
import {
  typeDefs as campaignMemberTypeDefs,
  resolvers as campaignMemberResolvers,
} from "../modules/campaignMembers/graphql";
import {
  typeDefs as noteTypeDefs,
  resolvers as noteResolvers,
} from "../modules/notes/graphql";
import {
  typeDefs as attachmentTypeDefs,
  resolvers as attachmentResolvers,
} from "../modules/attachments/graphql";
import {
  typeDefs as noteLinkTypeDefs,
  resolvers as noteLinkResolvers,
} from "../modules/noteLinks/graphql";
import {
  typeDefs as sessionTypeDefs,
  resolvers as sessionResolvers,
} from "../modules/sessions/graphql";

const rootTypeDefs = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "schema", "Root.graphql"),
  "utf-8",
);

export const schema = createSchema({
  typeDefs: [
    rootTypeDefs,
    ...entityTypeDefs,
    ...authTypeDefs,
    ...campTypeDefs,
    ...tagTypeDefs,
    ...relationshipTypeDefs,
    ...campaignMemberTypeDefs,
    ...noteTypeDefs,
    ...attachmentTypeDefs,
    ...noteLinkTypeDefs,
    ...sessionTypeDefs,
  ],
  resolvers: [
    entityResolvers,
    authResolvers,
    campResolvers,
    tagResolvers,
    relationshipResolvers,
    campaignMemberResolvers,
    noteResolvers,
    attachmentResolvers,
    noteLinkResolvers,
    sessionResolvers,
  ],
});
