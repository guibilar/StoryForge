/* eslint-disable */
import * as types from "./graphql";
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";

/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
type Documents = {
  "query Campaigns {\n  campaigns {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}": typeof types.CampaignsDocument;
  "mutation CreateCampaign($input: CreateCampaignDTO!) {\n  createCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}": typeof types.CreateCampaignDocument;
  "mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}": typeof types.LoginDocument;
  "mutation Logout {\n  logout\n}": typeof types.LogoutDocument;
  "query Me {\n  me {\n    id\n    email\n  }\n}": typeof types.MeDocument;
  "mutation Register($input: RegisterUserInput!) {\n  registerUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}": typeof types.RegisterDocument;
};
const documents: Documents = {
  "query Campaigns {\n  campaigns {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}":
    types.CampaignsDocument,
  "mutation CreateCampaign($input: CreateCampaignDTO!) {\n  createCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}":
    types.CreateCampaignDocument,
  "mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}":
    types.LoginDocument,
  "mutation Logout {\n  logout\n}": types.LogoutDocument,
  "query Me {\n  me {\n    id\n    email\n  }\n}": types.MeDocument,
  "mutation Register($input: RegisterUserInput!) {\n  registerUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}":
    types.RegisterDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 *
 *
 * @example
 * ```ts
 * const query = graphql(`query GetUser($id: ID!) { user(id: $id) { name } }`);
 * ```
 *
 * The query argument is unknown!
 * Please regenerate the types.
 */
export function graphql(source: string): unknown;

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Campaigns {\n  campaigns {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}",
): (typeof documents)["query Campaigns {\n  campaigns {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation CreateCampaign($input: CreateCampaignDTO!) {\n  createCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}",
): (typeof documents)["mutation CreateCampaign($input: CreateCampaignDTO!) {\n  createCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}",
): (typeof documents)["mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation Logout {\n  logout\n}",
): (typeof documents)["mutation Logout {\n  logout\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Me {\n  me {\n    id\n    email\n  }\n}",
): (typeof documents)["query Me {\n  me {\n    id\n    email\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation Register($input: RegisterUserInput!) {\n  registerUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}",
): (typeof documents)["mutation Register($input: RegisterUserInput!) {\n  registerUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
