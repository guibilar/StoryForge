import { Entity } from "./Entity";
import { EntityCategory } from "./EntityCategory";
import { EntityId } from "./EntityId";

export interface EntityFilter {
  type?: string;
  category?: EntityCategory;
  isPlayerCharacter?: boolean;
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

  findByName(campaignId: string, name: string): Promise<Entity | null>;

  create(entity: Entity): Promise<void>;

  update(entity: Entity): Promise<void>;
}
