import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntityWindow } from "./EntityWindow";

describe("EntityWindow", () => {
  it("shows the entity's name, type, and visibility", () => {
    render(
      <EntityWindow
        entity={{
          id: "e-1",
          name: "Carlos Mendoza",
          type: "Character",
          description: "A Tremere regent",
          visibility: "PUBLIC",
        }}
      />,
    );

    expect(screen.getByText("Carlos Mendoza")).toBeInTheDocument();
    expect(screen.getByText("Character")).toBeInTheDocument();
    expect(screen.getByText("PUBLIC")).toBeInTheDocument();
    expect(screen.getByText("A Tremere regent")).toBeInTheDocument();
  });

  it("shows a placeholder when there's no description", () => {
    render(
      <EntityWindow
        entity={{
          id: "e-2",
          name: "Downtown",
          type: "Location",
          description: null,
          visibility: "PUBLIC",
        }}
      />,
    );

    expect(screen.getByText("No description yet.")).toBeInTheDocument();
  });
});
