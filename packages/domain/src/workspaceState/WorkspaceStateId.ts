import { Id } from "../shared/Id";

export type WorkspaceStateId = Id<"WorkspaceState">;

export const WorkspaceStateId = {
  create: (): WorkspaceStateId => Id.create<"WorkspaceState">(),
  fromString: (value: string): WorkspaceStateId =>
    Id.fromString<"WorkspaceState">(value),
};
