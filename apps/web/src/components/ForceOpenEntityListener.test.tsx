import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSubscription } from "urql";

import { ForceOpenEntityListener } from "./ForceOpenEntityListener";
import { useDesktopWindows } from "../lib/DesktopWindowsContext";
import { OnEntityWindowForceOpenedDocument } from "../gql/graphql";

vi.mock("urql", async (importOriginal) => {
  const actual = await importOriginal<typeof import("urql")>();
  return { ...actual, useSubscription: vi.fn() };
});

vi.mock("../lib/DesktopWindowsContext", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../lib/DesktopWindowsContext")>();
  return { ...actual, useDesktopWindows: vi.fn() };
});

const ENTITY_PAYLOAD = {
  id: "e-1",
  campaignId: "camp-1",
  type: "Character",
  name: "Carlos Mendoza",
  description: "A Tremere regent",
  image: null,
  visibility: "STORYTELLER",
};

function setupSubscription(
  entity: typeof ENTITY_PAYLOAD | undefined = undefined,
) {
  vi.mocked(useSubscription).mockImplementation(((args: { query: unknown }) => {
    if (args.query === OnEntityWindowForceOpenedDocument) {
      return [
        {
          data: entity ? { entityWindowForceOpened: entity } : undefined,
          fetching: false,
          stale: false,
        },
        vi.fn(),
      ];
    }
    throw new Error("Unexpected subscription in test");
  }) as never);
}

function setupDesktopWindows() {
  const openWindow = vi.fn();
  vi.mocked(useDesktopWindows).mockReturnValue({
    layout: {},
    bringToFront: vi.fn(),
    toggle: vi.fn(),
    startDrag: vi.fn(),
    startResize: vi.fn(),
    reset: vi.fn(),
    dynamicWindows: {},
    openWindow,
    closeWindow: vi.fn(),
    recentIds: [],
    presets: {},
    savePreset: vi.fn(),
    applyPreset: vi.fn(),
    hydrateFromServer: vi.fn(),
  });
  return { openWindow };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ForceOpenEntityListener", () => {
  it("renders nothing and does not open a window when no payload has arrived", () => {
    setupSubscription(undefined);
    const { openWindow } = setupDesktopWindows();

    const { container } = render(
      <ForceOpenEntityListener campaignId="camp-1" />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it("opens the entity window for the entity in a delivered subscription payload, for any role", () => {
    setupSubscription(ENTITY_PAYLOAD);
    const { openWindow } = setupDesktopWindows();

    render(<ForceOpenEntityListener campaignId="camp-1" />);

    expect(openWindow).toHaveBeenCalledTimes(1);
    expect(openWindow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "entity:e-1",
        title: "Carlos Mendoza",
      }),
    );

    // The rendered window content is EntityWindow, seeded with exactly the
    // entity carried by the subscription payload — the server already
    // decided delivery, so this must render it unconditionally rather than
    // re-deriving it from some other query.
    const request = vi.mocked(openWindow).mock.calls[0][0] as {
      render: () => { props: { entity: unknown; campaignId: string } };
    };
    const element = request.render();
    expect(element.props.entity).toEqual(ENTITY_PAYLOAD);
    expect(element.props.campaignId).toBe("camp-1");
  });

  it("does not re-open the window on a re-render with the same payload reference", () => {
    setupSubscription(ENTITY_PAYLOAD);
    const { openWindow } = setupDesktopWindows();

    const { rerender } = render(
      <ForceOpenEntityListener campaignId="camp-1" />,
    );
    rerender(<ForceOpenEntityListener campaignId="camp-1" />);

    expect(openWindow).toHaveBeenCalledTimes(1);
  });
});
