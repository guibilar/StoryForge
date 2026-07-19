import type { CampaignRole } from "../gql/graphql";

// A member row `BroadcastTargetPicker` can target — the fields it needs off
// of `CampaignDocument`'s `members` (see MembersWindow.tsx/MapsWindow.tsx),
// deliberately narrow so any caller already holding that query's result can
// pass it straight through without reshaping it.
export interface BroadcastableMember {
  userId: string;
  role: CampaignRole;
  user: { email: string };
}

// Mirrors the `{ allPlayers, userIds }` shape shared by every Storyteller
// push-to-player mutation's `target` input (KAN-129's `forceSyncViewport`,
// KAN-132's `forceOpenEntityWindow`) — a caller can pass this value straight
// through as that argument. `userIds` only ever holds zero or one id: the
// picker offers "all players" or a single specific member, never a
// multi-select.
export interface BroadcastTarget {
  allPlayers: boolean;
  userIds: string[];
}

export const ALL_PLAYERS_TARGET: BroadcastTarget = {
  allPlayers: true,
  userIds: [],
};
