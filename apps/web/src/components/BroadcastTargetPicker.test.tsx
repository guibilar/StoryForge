import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BroadcastTargetPicker } from "./BroadcastTargetPicker";
import { ALL_PLAYERS_TARGET } from "../lib/broadcastTarget";
import type { BroadcastableMember } from "../lib/broadcastTarget";

const members: BroadcastableMember[] = [
  { userId: "user-1", role: "OWNER", user: { email: "owner@example.com" } },
  { userId: "user-2", role: "PLAYER", user: { email: "player@example.com" } },
  {
    userId: "user-3",
    role: "OBSERVER",
    user: { email: "observer@example.com" },
  },
  {
    userId: "user-4",
    role: "CO_STORYTELLER",
    user: { email: "co-st@example.com" },
  },
];

describe("BroadcastTargetPicker", () => {
  it("offers 'All players' plus only PLAYER/OBSERVER members, not Storyteller-tier ones", () => {
    render(
      <BroadcastTargetPicker
        members={members}
        value={ALL_PLAYERS_TARGET}
        onChange={vi.fn()}
      />,
    );

    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual([
      "All players",
      "player@example.com",
      "observer@example.com",
    ]);
  });

  it("defaults to 'All players' selected when value.allPlayers is true", () => {
    render(
      <BroadcastTargetPicker
        members={members}
        value={ALL_PLAYERS_TARGET}
        onChange={vi.fn()}
      />,
    );

    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(
      "__all_players__",
    );
  });

  it("reports { allPlayers: true, userIds: [] } when 'All players' is chosen", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BroadcastTargetPicker
        members={members}
        value={{ allPlayers: false, userIds: ["user-2"] }}
        onChange={onChange}
      />,
    );

    await user.selectOptions(screen.getByRole("combobox"), "All players");

    expect(onChange).toHaveBeenCalledWith({ allPlayers: true, userIds: [] });
  });

  it("reports { allPlayers: false, userIds: [id] } when a specific member is chosen", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <BroadcastTargetPicker
        members={members}
        value={ALL_PLAYERS_TARGET}
        onChange={onChange}
      />,
    );

    await user.selectOptions(
      screen.getByRole("combobox"),
      "player@example.com",
    );

    expect(onChange).toHaveBeenCalledWith({
      allPlayers: false,
      userIds: ["user-2"],
    });
  });

  it("disables the select when disabled is set", () => {
    render(
      <BroadcastTargetPicker
        members={members}
        value={ALL_PLAYERS_TARGET}
        onChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
