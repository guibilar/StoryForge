import { User, UserId } from "@storyforge/domain";
import type { User as PrismaUser } from "@storyforge/database";

export class UserMapper {
  static toDomain(record: PrismaUser): User {
    return User.rehydrate({
      id: UserId.fromString(record.id),
      email: record.email,
      password: record.password,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  static toPersistence(entity: User) {
    return {
      id: entity.Id.toString(),
      email: entity.Email,
      password: entity.Password,
    };
  }
}
