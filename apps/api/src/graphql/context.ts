import { YogaInitialContext } from "graphql-yoga";
import jwt from "jsonwebtoken";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
  parseCookie,
  serializeCookie,
} from "./cookies";
import { EntityService } from "../modules/entities/application/EntityService";
import { PrismaEntityRepository } from "../modules/entities/infrastructure/PrismaEntityRepository";
import { AuthenticationService } from "../modules/auth/application/AuthenticationService";
import { PrismaUserRepository } from "../modules/auth/infrastructure/PrismaUserRepository";
import { JWT_SECRET } from "../config/env";
import { CampaignService } from "../modules/campaigns/application/CampaignService";
import { PrismaCampaignRepository } from "../modules/campaigns/infrastructure/PrismaCampaignRepository";
import { User, UserId, UserRepository } from "@storyforge/domain";
import { LocalImageStore } from "../modules/entities/infrastructure/LocalImageStore";
import { TagService } from "../modules/tags/application/TagService";
import { PrismaTagRepository } from "../modules/tags/infrastructure/PrismaTagRepository";
import { RelationshipService } from "../modules/relationships/application/RelationshipService";
import { PrismaRelationshipRepository } from "../modules/relationships/infrastructure/PrismaRelationshipRepository";
import { CampaignMemberService } from "../modules/campaignMembers/application/CampaignMemberService";
import { PrismaCampaignMemberRepository } from "../modules/campaignMembers/infrastructure/PrismaCampaignMemberRepository";
import { NoteService } from "../modules/notes/application/NoteService";
import { PrismaNoteRepository } from "../modules/notes/infrastructure/PrismaNoteRepository";
import { AttachmentService } from "../modules/attachments/application/AttachmentService";
import { PrismaAttachmentRepository } from "../modules/attachments/infrastructure/PrismaAttachmentRepository";
import { PrismaNoteLinkRepository } from "../modules/noteLinks/infrastructure/PrismaNoteLinkRepository";
import { SessionService } from "../modules/sessions/application/SessionService";
import { PrismaSessionRepository } from "../modules/sessions/infrastructure/PrismaSessionRepository";
import { EventService } from "../modules/events/application/EventService";
import { PrismaEventRepository } from "../modules/events/infrastructure/PrismaEventRepository";
import { WorkspaceService } from "../modules/workspace/application/WorkspaceService";
import { PrismaWorkspaceStateRepository } from "../modules/workspace/infrastructure/PrismaWorkspaceStateRepository";

export interface GraphQLContext extends YogaInitialContext {
  req: IncomingMessage;
  res: ServerResponse;
  requestId: string;
  entityService: EntityService;
  authenticationService: AuthenticationService;
  campaignService: CampaignService;
  currentUserId: string | null;
  currentUser: User | null;
  userRepository: UserRepository;
  setAuthCookie: (token: string) => void;
  clearAuthCookie: () => void;
  imageStorage: LocalImageStore;
  tagService: TagService;
  relationshipService: RelationshipService;
  campaignMemberService: CampaignMemberService;
  noteService: NoteService;
  attachmentService: AttachmentService;
  sessionService: SessionService;
  eventService: EventService;
  workspaceService: WorkspaceService;
}

const noteLinkRepository = new PrismaNoteLinkRepository();
const entityService = new EntityService(
  new PrismaEntityRepository(),
  noteLinkRepository,
);
const campaignMemberRepository = new PrismaCampaignMemberRepository();
const campaignService = new CampaignService(
  new PrismaCampaignRepository(),
  campaignMemberRepository,
);
const userRepository = new PrismaUserRepository();
const tagService = new TagService(
  new PrismaTagRepository(),
  new PrismaEntityRepository(),
);
const relationshipService = new RelationshipService(
  new PrismaRelationshipRepository(),
  new PrismaEntityRepository(),
);
const campaignMemberService = new CampaignMemberService(
  campaignMemberRepository,
  userRepository,
);
const authenticationService = new AuthenticationService(userRepository);
const imageStorage = new LocalImageStore();
const noteService = new NoteService(
  new PrismaNoteRepository(),
  new PrismaEntityRepository(),
  noteLinkRepository,
  campaignMemberRepository,
);
const attachmentService = new AttachmentService(
  new PrismaAttachmentRepository(),
  imageStorage,
);
const sessionService = new SessionService(
  new PrismaSessionRepository(),
  campaignMemberRepository,
);
const eventService = new EventService(
  new PrismaEventRepository(),
  new PrismaEntityRepository(),
  new PrismaSessionRepository(),
);
const workspaceService = new WorkspaceService(
  new PrismaWorkspaceStateRepository(),
);

export function getCurrentUserId(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : parseCookie(request.headers.get("cookie"), AUTH_COOKIE_NAME);

  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

function appendSetCookie(res: ServerResponse, cookie: string): void {
  const existing = res.getHeader("Set-Cookie");
  const cookies = existing
    ? (Array.isArray(existing) ? existing : [existing]).map(String)
    : [];

  cookies.push(cookie);
  res.setHeader("Set-Cookie", cookies);
}

export async function createContext(
  initialContext: YogaInitialContext & {
    req: IncomingMessage;
    res: ServerResponse;
  },
): Promise<GraphQLContext> {
  const currentUserId = getCurrentUserId(initialContext.request);
  const currentUser = currentUserId
    ? await userRepository.findById(UserId.fromString(currentUserId))
    : null;
  return {
    ...initialContext,
    requestId: crypto.randomUUID(),
    entityService,
    authenticationService,
    campaignService,
    currentUserId,
    currentUser,
    userRepository,
    setAuthCookie: (token: string) =>
      appendSetCookie(
        initialContext.res,
        serializeCookie(AUTH_COOKIE_NAME, token, {
          maxAge: AUTH_COOKIE_MAX_AGE,
        }),
      ),
    clearAuthCookie: () =>
      appendSetCookie(
        initialContext.res,
        serializeCookie(AUTH_COOKIE_NAME, "", { maxAge: 0 }),
      ),
    imageStorage,
    tagService,
    relationshipService,
    campaignMemberService,
    noteService,
    attachmentService,
    sessionService,
    eventService,
    workspaceService,
  };
}
