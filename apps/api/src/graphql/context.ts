import { YogaInitialContext } from "graphql-yoga";
import jwt from "jsonwebtoken";

import { EntityService } from "../modules/entities/application/EntityService";
import { PrismaEntityRepository } from "../modules/entities/infrastructure/PrismaEntityRepository";
import { AuthenticationService } from "../modules/auth/application/AuthenticationService";
import { PrismaUserRepository } from "../modules/auth/infrastructure/PrismaUserRepository";
import { JWT_SECRET } from "../config/env";
import { CampaignService } from "../modules/campaigns/application/CampaignService";
import { PrismaCampaignRepository } from "../modules/campaigns/infrastructure/PrismaCampaignRepository";
import { User, UserId } from "@storyforge/domain";
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

export interface GraphQLContext extends YogaInitialContext {
  requestId: string;
  entityService: EntityService;
  authenticationService: AuthenticationService;
  campaignService: CampaignService;
  currentUserId: string | null;
  currentUser: User | null;
  imageStorage: LocalImageStore;
  tagService: TagService;
  relationshipService: RelationshipService;
  campaignMemberService: CampaignMemberService;
  noteService: NoteService;
  attachmentService: AttachmentService;
}

const entityService = new EntityService(new PrismaEntityRepository());
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
  new PrismaNoteLinkRepository(),
);
const attachmentService = new AttachmentService(
  new PrismaAttachmentRepository(),
);

function getCurrentUserId(request: Request): string | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (typeof payload === "string" || typeof payload.sub !== "string") {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

export async function createContext(
  initialContext: YogaInitialContext,
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
    imageStorage,
    tagService,
    relationshipService,
    campaignMemberService,
    noteService,
    attachmentService,
  };
}
