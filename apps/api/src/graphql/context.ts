import { YogaInitialContext } from "graphql-yoga";

import { EntityService } from "../modules/entities/application/EntityService";
import { PrismaEntityRepository } from "../modules/entities/infrastructure/PrismaEntityRepository";

export interface GraphQLContext extends YogaInitialContext {
    requestId: string;
    entityService: EntityService;
}

const entityService = new EntityService(new PrismaEntityRepository());

export async function createContext(
    initialContext: YogaInitialContext,
): Promise<GraphQLContext> {
    return {
        ...initialContext,
        requestId: crypto.randomUUID(),
        entityService,
    };
}