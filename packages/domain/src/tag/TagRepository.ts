import { Tag } from "./Tag";
import { TagId } from "./TagId";

export interface TagRepository {
  findById(id: TagId): Promise<Tag | null>;

  findByCampaign(campaignId: string): Promise<Tag[]>;

  findByCampaignAndName(campaignId: string, name: string): Promise<Tag | null>;

  findByEntity(entityId: string): Promise<Tag[]>;

  create(entity: Tag): Promise<void>;

  attachToEntity(tagId: TagId, entityId: string): Promise<void>;

  detachFromEntity(tagId: TagId, entityId: string): Promise<void>;
}
