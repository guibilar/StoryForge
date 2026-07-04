import { YogaInitialContext } from "graphql-yoga";
import jwt from "jsonwebtoken";

import { EntityService } from "../modules/entities/application/EntityService";
import { PrismaEntityRepository } from "../modules/entities/infrastructure/PrismaEntityRepository";
import { AuthenticationService } from "../modules/auth/application/AuthenticationService";
import { PrismaUserRepository } from "../modules/auth/infrastructure/PrismaUserRepository";
import { JWT_SECRET } from "../config/env";

export interface GraphQLContext extends YogaInitialContext {
  requestId: string;
  entityService: EntityService;
  authenticationService: AuthenticationService;
  currentUserId: string | null;
}

const entityService = new EntityService(new PrismaEntityRepository());
const authenticationService = new AuthenticationService(
  new PrismaUserRepository(),
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
  return {
    ...initialContext,
    requestId: crypto.randomUUID(),
    entityService,
    authenticationService,
    currentUserId: getCurrentUserId(initialContext.request),
  };
}
