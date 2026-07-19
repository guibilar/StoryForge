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
  "mutation AddCampaignMember($input: AddCampaignMemberInput!) {\n  addCampaignMember(input: $input) {\n    userId\n    role\n    user {\n      id\n      email\n    }\n  }\n}": typeof types.AddCampaignMemberDocument;
  "mutation ArchiveCampaign($id: ID!) {\n  archiveCampaign(id: $id)\n}": typeof types.ArchiveCampaignDocument;
  "mutation AttachParticipant($eventId: ID!, $entityId: ID!) {\n  attachParticipant(eventId: $eventId, entityId: $entityId) {\n    id\n    participants {\n      id\n      name\n    }\n  }\n}": typeof types.AttachParticipantDocument;
  "mutation AttachSessionAttendee($sessionId: ID!, $userId: ID!) {\n  attachSessionAttendee(sessionId: $sessionId, userId: $userId) {\n    id\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}": typeof types.AttachSessionAttendeeDocument;
  "query Campaign($id: ID!) {\n  campaign(id: $id) {\n    id\n    name\n    members {\n      userId\n      role\n      user {\n        id\n        email\n      }\n    }\n  }\n}": typeof types.CampaignDocument;
  "query Campaigns {\n  campaigns {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}": typeof types.CampaignsDocument;
  "mutation CreateCampaign($input: CreateCampaignDTO!) {\n  createCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}": typeof types.CreateCampaignDocument;
  "mutation CreateEntity($input: CreateEntityInput!) {\n  createEntity(input: $input) {\n    id\n    name\n    description\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}": typeof types.CreateEntityDocument;
  "mutation CreateEvent($input: CreateEventInput!) {\n  createEvent(input: $input) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}": typeof types.CreateEventDocument;
  "mutation CreateMarker($input: CreateMarkerInput!) {\n  createMarker(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}": typeof types.CreateMarkerDocument;
  "mutation CreateNote($input: CreateNoteInput!) {\n  createNote(input: $input) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}": typeof types.CreateNoteDocument;
  "mutation CreateSession($input: CreateSessionInput!) {\n  createSession(input: $input) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}": typeof types.CreateSessionDocument;
  "mutation CreateTerritory($input: CreateTerritoryInput!) {\n  createTerritory(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}": typeof types.CreateTerritoryDocument;
  "mutation DeleteEntity($id: ID!) {\n  deleteEntity(id: $id)\n}": typeof types.DeleteEntityDocument;
  "mutation DeleteEvent($id: ID!) {\n  deleteEvent(id: $id)\n}": typeof types.DeleteEventDocument;
  "mutation DeleteMapImage($campaignId: ID!) {\n  deleteMapImage(campaignId: $campaignId)\n}": typeof types.DeleteMapImageDocument;
  "mutation DeleteMarker($id: ID!) {\n  deleteMarker(id: $id)\n}": typeof types.DeleteMarkerDocument;
  "mutation DeleteNote($id: ID!) {\n  deleteNote(id: $id)\n}": typeof types.DeleteNoteDocument;
  "mutation DeleteSession($id: ID!) {\n  deleteSession(id: $id)\n}": typeof types.DeleteSessionDocument;
  "mutation DeleteTerritory($id: ID!) {\n  deleteTerritory(id: $id)\n}": typeof types.DeleteTerritoryDocument;
  "mutation DetachParticipant($eventId: ID!, $entityId: ID!) {\n  detachParticipant(eventId: $eventId, entityId: $entityId) {\n    id\n    participants {\n      id\n      name\n    }\n  }\n}": typeof types.DetachParticipantDocument;
  "mutation DetachSessionAttendee($sessionId: ID!, $userId: ID!) {\n  detachSessionAttendee(sessionId: $sessionId, userId: $userId) {\n    id\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}": typeof types.DetachSessionAttendeeDocument;
  "query Entities($campaignId: ID!, $filter: EntityFilter) {\n  entities(campaignId: $campaignId, filter: $filter) {\n    id\n    name\n    description\n    type\n    category\n    isPlayerCharacter\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}": typeof types.EntitiesDocument;
  "query Events($campaignId: ID!) {\n  events(campaignId: $campaignId) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}": typeof types.EventsDocument;
  "mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}": typeof types.LoginDocument;
  "mutation Logout {\n  logout\n}": typeof types.LogoutDocument;
  "query MapImage($campaignId: ID!) {\n  mapImage(campaignId: $campaignId) {\n    id\n    url\n    fileName\n    width\n    height\n  }\n}": typeof types.MapImageDocument;
  "query Markers($campaignId: ID!) {\n  markers(campaignId: $campaignId) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}": typeof types.MarkersDocument;
  "query Me {\n  me {\n    id\n    email\n  }\n}": typeof types.MeDocument;
  "query MyWorkspaceState($campaignId: ID!) {\n  myWorkspaceState(campaignId: $campaignId) {\n    id\n    layout\n    recentEntityIds\n    updatedAt\n  }\n}": typeof types.MyWorkspaceStateDocument;
  "query Notes($campaignId: ID!) {\n  noteRoots(campaignId: $campaignId) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}": typeof types.NotesDocument;
  "mutation Register($input: RegisterUserInput!) {\n  registerUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}": typeof types.RegisterDocument;
  "query Relationships($campaignId: ID!, $entityId: ID) {\n  relationships(campaignId: $campaignId, entityId: $entityId) {\n    id\n    sourceEntityId\n    targetEntityId\n    type\n    description\n  }\n}": typeof types.RelationshipsDocument;
  "mutation RemoveCampaignMember($campaignId: ID!, $userId: ID!) {\n  removeCampaignMember(campaignId: $campaignId, userId: $userId)\n}": typeof types.RemoveCampaignMemberDocument;
  "mutation SaveWorkspaceState($input: SaveWorkspaceStateInput!) {\n  saveWorkspaceState(input: $input) {\n    id\n    updatedAt\n  }\n}": typeof types.SaveWorkspaceStateDocument;
  "query Sessions($campaignId: ID!) {\n  sessions(campaignId: $campaignId) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}": typeof types.SessionsDocument;
  "query Territories($campaignId: ID!) {\n  territories(campaignId: $campaignId) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}": typeof types.TerritoriesDocument;
  "mutation UpdateCampaign($input: UpdateCampaignInput!) {\n  updateCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n  }\n}": typeof types.UpdateCampaignDocument;
  "mutation UpdateCampaignMemberRole($input: UpdateCampaignMemberRoleInput!) {\n  updateCampaignMemberRole(input: $input) {\n    userId\n    role\n  }\n}": typeof types.UpdateCampaignMemberRoleDocument;
  "mutation UpdateEntity($input: UpdateEntityInput!) {\n  updateEntity(input: $input) {\n    id\n    name\n    description\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}": typeof types.UpdateEntityDocument;
  "mutation UpdateEvent($input: UpdateEventInput!) {\n  updateEvent(input: $input) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}": typeof types.UpdateEventDocument;
  "mutation UpdateMarker($input: UpdateMarkerInput!) {\n  updateMarker(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}": typeof types.UpdateMarkerDocument;
  "mutation UpdateNote($input: UpdateNoteInput!) {\n  updateNote(input: $input) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}": typeof types.UpdateNoteDocument;
  "mutation UpdateSession($input: UpdateSessionInput!) {\n  updateSession(input: $input) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}": typeof types.UpdateSessionDocument;
  "mutation UpdateTerritory($input: UpdateTerritoryInput!) {\n  updateTerritory(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}": typeof types.UpdateTerritoryDocument;
  "mutation UploadMapImage($campaignId: ID!, $file: Upload!) {\n  uploadMapImage(campaignId: $campaignId, file: $file) {\n    id\n    url\n    fileName\n    width\n    height\n  }\n}": typeof types.UploadMapImageDocument;
};
const documents: Documents = {
  "mutation AddCampaignMember($input: AddCampaignMemberInput!) {\n  addCampaignMember(input: $input) {\n    userId\n    role\n    user {\n      id\n      email\n    }\n  }\n}":
    types.AddCampaignMemberDocument,
  "mutation ArchiveCampaign($id: ID!) {\n  archiveCampaign(id: $id)\n}":
    types.ArchiveCampaignDocument,
  "mutation AttachParticipant($eventId: ID!, $entityId: ID!) {\n  attachParticipant(eventId: $eventId, entityId: $entityId) {\n    id\n    participants {\n      id\n      name\n    }\n  }\n}":
    types.AttachParticipantDocument,
  "mutation AttachSessionAttendee($sessionId: ID!, $userId: ID!) {\n  attachSessionAttendee(sessionId: $sessionId, userId: $userId) {\n    id\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}":
    types.AttachSessionAttendeeDocument,
  "query Campaign($id: ID!) {\n  campaign(id: $id) {\n    id\n    name\n    members {\n      userId\n      role\n      user {\n        id\n        email\n      }\n    }\n  }\n}":
    types.CampaignDocument,
  "query Campaigns {\n  campaigns {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}":
    types.CampaignsDocument,
  "mutation CreateCampaign($input: CreateCampaignDTO!) {\n  createCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n    members {\n      userId\n      role\n    }\n  }\n}":
    types.CreateCampaignDocument,
  "mutation CreateEntity($input: CreateEntityInput!) {\n  createEntity(input: $input) {\n    id\n    name\n    description\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}":
    types.CreateEntityDocument,
  "mutation CreateEvent($input: CreateEventInput!) {\n  createEvent(input: $input) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}":
    types.CreateEventDocument,
  "mutation CreateMarker($input: CreateMarkerInput!) {\n  createMarker(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}":
    types.CreateMarkerDocument,
  "mutation CreateNote($input: CreateNoteInput!) {\n  createNote(input: $input) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}":
    types.CreateNoteDocument,
  "mutation CreateSession($input: CreateSessionInput!) {\n  createSession(input: $input) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}":
    types.CreateSessionDocument,
  "mutation CreateTerritory($input: CreateTerritoryInput!) {\n  createTerritory(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}":
    types.CreateTerritoryDocument,
  "mutation DeleteEntity($id: ID!) {\n  deleteEntity(id: $id)\n}":
    types.DeleteEntityDocument,
  "mutation DeleteEvent($id: ID!) {\n  deleteEvent(id: $id)\n}":
    types.DeleteEventDocument,
  "mutation DeleteMapImage($campaignId: ID!) {\n  deleteMapImage(campaignId: $campaignId)\n}":
    types.DeleteMapImageDocument,
  "mutation DeleteMarker($id: ID!) {\n  deleteMarker(id: $id)\n}":
    types.DeleteMarkerDocument,
  "mutation DeleteNote($id: ID!) {\n  deleteNote(id: $id)\n}":
    types.DeleteNoteDocument,
  "mutation DeleteSession($id: ID!) {\n  deleteSession(id: $id)\n}":
    types.DeleteSessionDocument,
  "mutation DeleteTerritory($id: ID!) {\n  deleteTerritory(id: $id)\n}":
    types.DeleteTerritoryDocument,
  "mutation DetachParticipant($eventId: ID!, $entityId: ID!) {\n  detachParticipant(eventId: $eventId, entityId: $entityId) {\n    id\n    participants {\n      id\n      name\n    }\n  }\n}":
    types.DetachParticipantDocument,
  "mutation DetachSessionAttendee($sessionId: ID!, $userId: ID!) {\n  detachSessionAttendee(sessionId: $sessionId, userId: $userId) {\n    id\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}":
    types.DetachSessionAttendeeDocument,
  "query Entities($campaignId: ID!, $filter: EntityFilter) {\n  entities(campaignId: $campaignId, filter: $filter) {\n    id\n    name\n    description\n    type\n    category\n    isPlayerCharacter\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}":
    types.EntitiesDocument,
  "query Events($campaignId: ID!) {\n  events(campaignId: $campaignId) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}":
    types.EventsDocument,
  "mutation Login($input: LoginInput!) {\n  login(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}":
    types.LoginDocument,
  "mutation Logout {\n  logout\n}": types.LogoutDocument,
  "query MapImage($campaignId: ID!) {\n  mapImage(campaignId: $campaignId) {\n    id\n    url\n    fileName\n    width\n    height\n  }\n}":
    types.MapImageDocument,
  "query Markers($campaignId: ID!) {\n  markers(campaignId: $campaignId) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}":
    types.MarkersDocument,
  "query Me {\n  me {\n    id\n    email\n  }\n}": types.MeDocument,
  "query MyWorkspaceState($campaignId: ID!) {\n  myWorkspaceState(campaignId: $campaignId) {\n    id\n    layout\n    recentEntityIds\n    updatedAt\n  }\n}":
    types.MyWorkspaceStateDocument,
  "query Notes($campaignId: ID!) {\n  noteRoots(campaignId: $campaignId) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}":
    types.NotesDocument,
  "mutation Register($input: RegisterUserInput!) {\n  registerUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}":
    types.RegisterDocument,
  "query Relationships($campaignId: ID!, $entityId: ID) {\n  relationships(campaignId: $campaignId, entityId: $entityId) {\n    id\n    sourceEntityId\n    targetEntityId\n    type\n    description\n  }\n}":
    types.RelationshipsDocument,
  "mutation RemoveCampaignMember($campaignId: ID!, $userId: ID!) {\n  removeCampaignMember(campaignId: $campaignId, userId: $userId)\n}":
    types.RemoveCampaignMemberDocument,
  "mutation SaveWorkspaceState($input: SaveWorkspaceStateInput!) {\n  saveWorkspaceState(input: $input) {\n    id\n    updatedAt\n  }\n}":
    types.SaveWorkspaceStateDocument,
  "query Sessions($campaignId: ID!) {\n  sessions(campaignId: $campaignId) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}":
    types.SessionsDocument,
  "query Territories($campaignId: ID!) {\n  territories(campaignId: $campaignId) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}":
    types.TerritoriesDocument,
  "mutation UpdateCampaign($input: UpdateCampaignInput!) {\n  updateCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n  }\n}":
    types.UpdateCampaignDocument,
  "mutation UpdateCampaignMemberRole($input: UpdateCampaignMemberRoleInput!) {\n  updateCampaignMemberRole(input: $input) {\n    userId\n    role\n  }\n}":
    types.UpdateCampaignMemberRoleDocument,
  "mutation UpdateEntity($input: UpdateEntityInput!) {\n  updateEntity(input: $input) {\n    id\n    name\n    description\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}":
    types.UpdateEntityDocument,
  "mutation UpdateEvent($input: UpdateEventInput!) {\n  updateEvent(input: $input) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}":
    types.UpdateEventDocument,
  "mutation UpdateMarker($input: UpdateMarkerInput!) {\n  updateMarker(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}":
    types.UpdateMarkerDocument,
  "mutation UpdateNote($input: UpdateNoteInput!) {\n  updateNote(input: $input) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}":
    types.UpdateNoteDocument,
  "mutation UpdateSession($input: UpdateSessionInput!) {\n  updateSession(input: $input) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}":
    types.UpdateSessionDocument,
  "mutation UpdateTerritory($input: UpdateTerritoryInput!) {\n  updateTerritory(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}":
    types.UpdateTerritoryDocument,
  "mutation UploadMapImage($campaignId: ID!, $file: Upload!) {\n  uploadMapImage(campaignId: $campaignId, file: $file) {\n    id\n    url\n    fileName\n    width\n    height\n  }\n}":
    types.UploadMapImageDocument,
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
  source: "mutation AddCampaignMember($input: AddCampaignMemberInput!) {\n  addCampaignMember(input: $input) {\n    userId\n    role\n    user {\n      id\n      email\n    }\n  }\n}",
): (typeof documents)["mutation AddCampaignMember($input: AddCampaignMemberInput!) {\n  addCampaignMember(input: $input) {\n    userId\n    role\n    user {\n      id\n      email\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation ArchiveCampaign($id: ID!) {\n  archiveCampaign(id: $id)\n}",
): (typeof documents)["mutation ArchiveCampaign($id: ID!) {\n  archiveCampaign(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation AttachParticipant($eventId: ID!, $entityId: ID!) {\n  attachParticipant(eventId: $eventId, entityId: $entityId) {\n    id\n    participants {\n      id\n      name\n    }\n  }\n}",
): (typeof documents)["mutation AttachParticipant($eventId: ID!, $entityId: ID!) {\n  attachParticipant(eventId: $eventId, entityId: $entityId) {\n    id\n    participants {\n      id\n      name\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation AttachSessionAttendee($sessionId: ID!, $userId: ID!) {\n  attachSessionAttendee(sessionId: $sessionId, userId: $userId) {\n    id\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}",
): (typeof documents)["mutation AttachSessionAttendee($sessionId: ID!, $userId: ID!) {\n  attachSessionAttendee(sessionId: $sessionId, userId: $userId) {\n    id\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Campaign($id: ID!) {\n  campaign(id: $id) {\n    id\n    name\n    members {\n      userId\n      role\n      user {\n        id\n        email\n      }\n    }\n  }\n}",
): (typeof documents)["query Campaign($id: ID!) {\n  campaign(id: $id) {\n    id\n    name\n    members {\n      userId\n      role\n      user {\n        id\n        email\n      }\n    }\n  }\n}"];
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
  source: "mutation CreateEntity($input: CreateEntityInput!) {\n  createEntity(input: $input) {\n    id\n    name\n    description\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}",
): (typeof documents)["mutation CreateEntity($input: CreateEntityInput!) {\n  createEntity(input: $input) {\n    id\n    name\n    description\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation CreateEvent($input: CreateEventInput!) {\n  createEvent(input: $input) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}",
): (typeof documents)["mutation CreateEvent($input: CreateEventInput!) {\n  createEvent(input: $input) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation CreateMarker($input: CreateMarkerInput!) {\n  createMarker(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}",
): (typeof documents)["mutation CreateMarker($input: CreateMarkerInput!) {\n  createMarker(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation CreateNote($input: CreateNoteInput!) {\n  createNote(input: $input) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}",
): (typeof documents)["mutation CreateNote($input: CreateNoteInput!) {\n  createNote(input: $input) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation CreateSession($input: CreateSessionInput!) {\n  createSession(input: $input) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}",
): (typeof documents)["mutation CreateSession($input: CreateSessionInput!) {\n  createSession(input: $input) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation CreateTerritory($input: CreateTerritoryInput!) {\n  createTerritory(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}",
): (typeof documents)["mutation CreateTerritory($input: CreateTerritoryInput!) {\n  createTerritory(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DeleteEntity($id: ID!) {\n  deleteEntity(id: $id)\n}",
): (typeof documents)["mutation DeleteEntity($id: ID!) {\n  deleteEntity(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DeleteEvent($id: ID!) {\n  deleteEvent(id: $id)\n}",
): (typeof documents)["mutation DeleteEvent($id: ID!) {\n  deleteEvent(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DeleteMapImage($campaignId: ID!) {\n  deleteMapImage(campaignId: $campaignId)\n}",
): (typeof documents)["mutation DeleteMapImage($campaignId: ID!) {\n  deleteMapImage(campaignId: $campaignId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DeleteMarker($id: ID!) {\n  deleteMarker(id: $id)\n}",
): (typeof documents)["mutation DeleteMarker($id: ID!) {\n  deleteMarker(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DeleteNote($id: ID!) {\n  deleteNote(id: $id)\n}",
): (typeof documents)["mutation DeleteNote($id: ID!) {\n  deleteNote(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DeleteSession($id: ID!) {\n  deleteSession(id: $id)\n}",
): (typeof documents)["mutation DeleteSession($id: ID!) {\n  deleteSession(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DeleteTerritory($id: ID!) {\n  deleteTerritory(id: $id)\n}",
): (typeof documents)["mutation DeleteTerritory($id: ID!) {\n  deleteTerritory(id: $id)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DetachParticipant($eventId: ID!, $entityId: ID!) {\n  detachParticipant(eventId: $eventId, entityId: $entityId) {\n    id\n    participants {\n      id\n      name\n    }\n  }\n}",
): (typeof documents)["mutation DetachParticipant($eventId: ID!, $entityId: ID!) {\n  detachParticipant(eventId: $eventId, entityId: $entityId) {\n    id\n    participants {\n      id\n      name\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation DetachSessionAttendee($sessionId: ID!, $userId: ID!) {\n  detachSessionAttendee(sessionId: $sessionId, userId: $userId) {\n    id\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}",
): (typeof documents)["mutation DetachSessionAttendee($sessionId: ID!, $userId: ID!) {\n  detachSessionAttendee(sessionId: $sessionId, userId: $userId) {\n    id\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Entities($campaignId: ID!, $filter: EntityFilter) {\n  entities(campaignId: $campaignId, filter: $filter) {\n    id\n    name\n    description\n    type\n    category\n    isPlayerCharacter\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}",
): (typeof documents)["query Entities($campaignId: ID!, $filter: EntityFilter) {\n  entities(campaignId: $campaignId, filter: $filter) {\n    id\n    name\n    description\n    type\n    category\n    isPlayerCharacter\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Events($campaignId: ID!) {\n  events(campaignId: $campaignId) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}",
): (typeof documents)["query Events($campaignId: ID!) {\n  events(campaignId: $campaignId) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}"];
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
  source: "query MapImage($campaignId: ID!) {\n  mapImage(campaignId: $campaignId) {\n    id\n    url\n    fileName\n    width\n    height\n  }\n}",
): (typeof documents)["query MapImage($campaignId: ID!) {\n  mapImage(campaignId: $campaignId) {\n    id\n    url\n    fileName\n    width\n    height\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Markers($campaignId: ID!) {\n  markers(campaignId: $campaignId) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}",
): (typeof documents)["query Markers($campaignId: ID!) {\n  markers(campaignId: $campaignId) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}"];
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
  source: "query MyWorkspaceState($campaignId: ID!) {\n  myWorkspaceState(campaignId: $campaignId) {\n    id\n    layout\n    recentEntityIds\n    updatedAt\n  }\n}",
): (typeof documents)["query MyWorkspaceState($campaignId: ID!) {\n  myWorkspaceState(campaignId: $campaignId) {\n    id\n    layout\n    recentEntityIds\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Notes($campaignId: ID!) {\n  noteRoots(campaignId: $campaignId) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}",
): (typeof documents)["query Notes($campaignId: ID!) {\n  noteRoots(campaignId: $campaignId) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation Register($input: RegisterUserInput!) {\n  registerUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}",
): (typeof documents)["mutation Register($input: RegisterUserInput!) {\n  registerUser(input: $input) {\n    user {\n      id\n      email\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Relationships($campaignId: ID!, $entityId: ID) {\n  relationships(campaignId: $campaignId, entityId: $entityId) {\n    id\n    sourceEntityId\n    targetEntityId\n    type\n    description\n  }\n}",
): (typeof documents)["query Relationships($campaignId: ID!, $entityId: ID) {\n  relationships(campaignId: $campaignId, entityId: $entityId) {\n    id\n    sourceEntityId\n    targetEntityId\n    type\n    description\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation RemoveCampaignMember($campaignId: ID!, $userId: ID!) {\n  removeCampaignMember(campaignId: $campaignId, userId: $userId)\n}",
): (typeof documents)["mutation RemoveCampaignMember($campaignId: ID!, $userId: ID!) {\n  removeCampaignMember(campaignId: $campaignId, userId: $userId)\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation SaveWorkspaceState($input: SaveWorkspaceStateInput!) {\n  saveWorkspaceState(input: $input) {\n    id\n    updatedAt\n  }\n}",
): (typeof documents)["mutation SaveWorkspaceState($input: SaveWorkspaceStateInput!) {\n  saveWorkspaceState(input: $input) {\n    id\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Sessions($campaignId: ID!) {\n  sessions(campaignId: $campaignId) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}",
): (typeof documents)["query Sessions($campaignId: ID!) {\n  sessions(campaignId: $campaignId) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "query Territories($campaignId: ID!) {\n  territories(campaignId: $campaignId) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}",
): (typeof documents)["query Territories($campaignId: ID!) {\n  territories(campaignId: $campaignId) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UpdateCampaign($input: UpdateCampaignInput!) {\n  updateCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n  }\n}",
): (typeof documents)["mutation UpdateCampaign($input: UpdateCampaignInput!) {\n  updateCampaign(input: $input) {\n    id\n    name\n    description\n    archivedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UpdateCampaignMemberRole($input: UpdateCampaignMemberRoleInput!) {\n  updateCampaignMemberRole(input: $input) {\n    userId\n    role\n  }\n}",
): (typeof documents)["mutation UpdateCampaignMemberRole($input: UpdateCampaignMemberRoleInput!) {\n  updateCampaignMemberRole(input: $input) {\n    userId\n    role\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UpdateEntity($input: UpdateEntityInput!) {\n  updateEntity(input: $input) {\n    id\n    name\n    description\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}",
): (typeof documents)["mutation UpdateEntity($input: UpdateEntityInput!) {\n  updateEntity(input: $input) {\n    id\n    name\n    description\n    visibility\n    tags {\n      id\n      name\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UpdateEvent($input: UpdateEventInput!) {\n  updateEvent(input: $input) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}",
): (typeof documents)["mutation UpdateEvent($input: UpdateEventInput!) {\n  updateEvent(input: $input) {\n    id\n    campaignId\n    title\n    description\n    occurredAt\n    sessionId\n    session {\n      id\n      sessionNumber\n    }\n    participants {\n      id\n      name\n    }\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UpdateMarker($input: UpdateMarkerInput!) {\n  updateMarker(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}",
): (typeof documents)["mutation UpdateMarker($input: UpdateMarkerInput!) {\n  updateMarker(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    lat\n    lng\n    description\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UpdateNote($input: UpdateNoteInput!) {\n  updateNote(input: $input) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}",
): (typeof documents)["mutation UpdateNote($input: UpdateNoteInput!) {\n  updateNote(input: $input) {\n    id\n    campaignId\n    authorId\n    title\n    content\n    visibility\n    recipientIds\n    createdAt\n    updatedAt\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UpdateSession($input: UpdateSessionInput!) {\n  updateSession(input: $input) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}",
): (typeof documents)["mutation UpdateSession($input: UpdateSessionInput!) {\n  updateSession(input: $input) {\n    id\n    sessionNumber\n    date\n    summary\n    attendees {\n      userId\n      user {\n        id\n        email\n      }\n    }\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UpdateTerritory($input: UpdateTerritoryInput!) {\n  updateTerritory(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}",
): (typeof documents)["mutation UpdateTerritory($input: UpdateTerritoryInput!) {\n  updateTerritory(input: $input) {\n    id\n    entityId\n    entity {\n      id\n      name\n      type\n      description\n      visibility\n    }\n    name\n    type\n    geometry\n    description\n  }\n}"];
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(
  source: "mutation UploadMapImage($campaignId: ID!, $file: Upload!) {\n  uploadMapImage(campaignId: $campaignId, file: $file) {\n    id\n    url\n    fileName\n    width\n    height\n  }\n}",
): (typeof documents)["mutation UploadMapImage($campaignId: ID!, $file: Upload!) {\n  uploadMapImage(campaignId: $campaignId, file: $file) {\n    id\n    url\n    fileName\n    width\n    height\n  }\n}"];

export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}

export type DocumentType<TDocumentNode extends DocumentNode<any, any>> =
  TDocumentNode extends DocumentNode<infer TType, any> ? TType : never;
