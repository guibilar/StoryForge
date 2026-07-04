import { User } from "./User";
import { UserId } from "./UserId";

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;

  findByEmail(email: string): Promise<User | null>;

  existsByEmail(email: string): Promise<boolean>;

  create(entity: User): Promise<void>;

  update(entity: User): Promise<void>;
}
