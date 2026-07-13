import { Entity } from "./Entity";
import { EntityId } from "./EntityId";

export interface EntityFilter {
  type?: string;
  nameContains?: string;
  tagIds?: string[];
}

export interface EntityRepository {
  findById(id: EntityId): Promise<Entity | null>;

  findByCampaign(
    campaignId: string,
    filter?: EntityFilter | null,
  ): Promise<Entity[]>;

  existsByName(campaignId: string, name: string): Promise<boolean>;

  create(entity: Entity): Promise<void>;

  update(entity: Entity): Promise<void>;
}
