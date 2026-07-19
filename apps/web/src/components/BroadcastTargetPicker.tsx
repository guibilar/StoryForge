import type { ChangeEvent } from "react";
import { Select } from "@storyforge/ui";

import type { CampaignRole } from "../gql/graphql";
import type {
  BroadcastableMember,
  BroadcastTarget,
} from "../lib/broadcastTarget";

export type {
  BroadcastableMember,
  BroadcastTarget,
} from "../lib/broadcastTarget";

const ALL_PLAYERS_OPTION_VALUE = "__all_players__";

// Only PLAYER/OBSERVER members are sensible broadcast recipients — the
// Storyteller(s) triggering the broadcast aren't targets of their own push.
const RECIPIENT_ROLES: CampaignRole[] = ["PLAYER", "OBSERVER"];

export interface BroadcastTargetPickerProps {
  members: BroadcastableMember[];
  value: BroadcastTarget;
  onChange: (target: BroadcastTarget) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

// Reusable "pick a player, or all players" control for Storyteller push
// actions. First built for KAN-131's viewport force-sync; KAN-133's
// force-open-entity-window control needs the exact same picker and should
// import this component unchanged rather than building its own.
export function BroadcastTargetPicker({
  members,
  value,
  onChange,
  disabled = false,
  id,
  "aria-label": ariaLabel = "Broadcast target",
}: BroadcastTargetPickerProps) {
  const recipients = members.filter((member) =>
    RECIPIENT_ROLES.includes(member.role),
  );
  const selectedValue = value.allPlayers
    ? ALL_PLAYERS_OPTION_VALUE
    : (value.userIds[0] ?? "");

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    onChange(
      next === ALL_PLAYERS_OPTION_VALUE
        ? { allPlayers: true, userIds: [] }
        : { allPlayers: false, userIds: [next] },
    );
  }

  return (
    <Select
      id={id}
      aria-label={ariaLabel}
      value={selectedValue}
      disabled={disabled}
      onChange={handleChange}
    >
      <option value={ALL_PLAYERS_OPTION_VALUE}>All players</option>
      {recipients.map((member) => (
        <option key={member.userId} value={member.userId}>
          {member.user.email}
        </option>
      ))}
    </Select>
  );
}
