import { User, UserRepository, UserId } from "@storyforge/domain";

import { prisma } from "@storyforge/database";
import { UserMapper } from "./UserMapper";

export class PrismaUserRepository implements UserRepository {
  async findById(id: UserId): Promise<User | null> {
    const record = await prisma.user.findUnique({
      where: {
        id: id.toString(),
      },
    });

    if (!record) {
      return null;
    }

    return UserMapper.toDomain(record);
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!record) {
      return null;
    }

    return UserMapper.toDomain(record);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const entity = await prisma.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    return entity !== null;
  }

  async create(entity: User): Promise<void> {
    await prisma.user.create({
      data: UserMapper.toPersistence(entity),
    });
  }

  async update(entity: User): Promise<void> {
    await prisma.user.update({
      where: {
        id: entity.Id.toString(),
      },
      data: UserMapper.toPersistence(entity),
    });
  }
}
