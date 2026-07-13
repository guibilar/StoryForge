import { Relationship } from "./Relationship";
import { RelationshipId } from "./RelationshipId";

export interface RelationshipRepository {
  findById(id: RelationshipId): Promise<Relationship | null>;

  findByCampaign(campaignId: string): Promise<Relationship[]>;

  findByEntity(entityId: string): Promise<Relationship[]>;

  existsByEdge(
    campaignId: string,
    sourceEntityId: string,
    targetEntityId: string,
    type: string,
  ): Promise<boolean>;

  create(relationship: Relationship): Promise<void>;

  update(relationship: Relationship): Promise<void>;
}
