import type { User as DomainUser } from "@storyforge/domain";

export const User = {
  id: (user: DomainUser) => user.Id.toString(),
  email: (user: DomainUser) => user.Email,
  createdAt: (user: DomainUser) => user.CreatedAt.toISOString(),
  updatedAt: (user: DomainUser) => user.UpdatedAt.toISOString(),
};
