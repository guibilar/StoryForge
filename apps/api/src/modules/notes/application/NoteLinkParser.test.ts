import { describe, expect, it } from "vitest";
import { parseNoteLinks } from "./NoteLinkParser";

describe("parseNoteLinks", () => {
  it("returns an empty array when there are no links", () => {
    expect(parseNoteLinks("Just plain text.")).toEqual([]);
  });

  it("parses a plain [[Label]] link", () => {
    expect(parseNoteLinks("Met [[Gruk the Orc]] at the tavern.")).toEqual([
      {
        label: "Gruk the Orc",
        explicitTargetType: undefined,
        explicitTargetId: undefined,
      },
    ]);
  });

  it("parses an explicit [[Label|entity:<id>]] link", () => {
    expect(parseNoteLinks("[[Gruk|entity:abc-123]]")).toEqual([
      {
        label: "Gruk",
        explicitTargetType: "entity",
        explicitTargetId: "abc-123",
      },
    ]);
  });

  it("parses an explicit [[Label|note:<id>]] link", () => {
    expect(parseNoteLinks("[[Session 0|note:xyz-789]]")).toEqual([
      {
        label: "Session 0",
        explicitTargetType: "note",
        explicitTargetId: "xyz-789",
      },
    ]);
  });

  it("parses multiple links in the same content", () => {
    const content = "Saw [[Gruk the Orc]] near [[The Rusty Anchor]].";

    expect(parseNoteLinks(content)).toEqual([
      {
        label: "Gruk the Orc",
        explicitTargetType: undefined,
        explicitTargetId: undefined,
      },
      {
        label: "The Rusty Anchor",
        explicitTargetType: undefined,
        explicitTargetId: undefined,
      },
    ]);
  });

  it("ignores a single-bracket markdown link", () => {
    expect(parseNoteLinks("[Gruk](https://example.com)")).toEqual([]);
  });
});
