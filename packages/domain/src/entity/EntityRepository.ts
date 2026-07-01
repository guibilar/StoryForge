import { Entity } from "./Entity";
import { EntityId } from "./EntityId";

export interface EntityRepository {
    findById(id: EntityId): Promise<Entity | null>;

    findByCampaign(campaignId: string): Promise<Entity[]>;

    existsByName(
        campaignId: string,
        name: string,
    ): Promise<boolean>;

    create(entity: Entity): Promise<void>;

    update(entity: Entity): Promise<void>;
}