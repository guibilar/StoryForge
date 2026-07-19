import { describe, expect, it } from "vitest";

import {
  parseWikiLinkHref,
  toMarkdownWithWikiLinks,
  wikiLinkFor,
} from "./noteLinks";

const TARGETS = {
  entities: [
    { id: "e-1", name: "Carlos Mendoza" },
    { id: "e-2", name: "Downtown" },
  ],
  notes: [{ id: "n-1", title: "Session 1 recap" }],
};

describe("toMarkdownWithWikiLinks", () => {
  it("links a bare label to a same-named entity", () => {
    expect(toMarkdownWithWikiLinks("Met [[Carlos Mendoza]].", TARGETS)).toBe(
      "Met [Carlos Mendoza](#sf-link:entity:e-1).",
    );
  });

  it("falls back to a note title when no entity matches", () => {
    expect(toMarkdownWithWikiLinks("See [[Session 1 recap]]", TARGETS)).toBe(
      "See [Session 1 recap](#sf-link:note:n-1)",
    );
  });

  it("honours an explicit entity id over the label", () => {
    expect(toMarkdownWithWikiLinks("[[The regent|entity:e-1]]", TARGETS)).toBe(
      "[The regent](#sf-link:entity:e-1)",
    );
  });

  it("renders an unknown reference as an unresolved link rather than dropping it", () => {
    expect(toMarkdownWithWikiLinks("[[Nobody]]", TARGETS)).toBe(
      "[Nobody](#sf-link:unresolved)",
    );
  });

  it("treats an explicit id the API did not resolve as unresolved", () => {
    expect(toMarkdownWithWikiLinks("[[Ghost|entity:e-99]]", TARGETS)).toBe(
      "[Ghost](#sf-link:unresolved)",
    );
  });

  it("rewrites every reference in the content", () => {
    expect(
      toMarkdownWithWikiLinks(
        "[[Carlos Mendoza]] met at [[Downtown]]",
        TARGETS,
      ),
    ).toBe(
      "[Carlos Mendoza](#sf-link:entity:e-1) met at [Downtown](#sf-link:entity:e-2)",
    );
  });

  it("tolerates surrounding whitespace inside the brackets", () => {
    expect(toMarkdownWithWikiLinks("[[  Downtown  ]]", TARGETS)).toBe(
      "[Downtown](#sf-link:entity:e-2)",
    );
  });

  it("escapes brackets in the label so the link text can't break the markdown", () => {
    const targets = { entities: [{ id: "e-3", name: "a\\b" }], notes: [] };
    expect(toMarkdownWithWikiLinks("[[a\\b]]", targets)).toBe(
      "[a\\\\b](#sf-link:entity:e-3)",
    );
  });

  it("leaves ordinary markdown links alone", () => {
    expect(
      toMarkdownWithWikiLinks("[docs](https://example.com)", TARGETS),
    ).toBe("[docs](https://example.com)");
  });
});

describe("parseWikiLinkHref", () => {
  it("reads back entity and note hrefs", () => {
    expect(parseWikiLinkHref("#sf-link:entity:e-1")).toEqual({
      kind: "entity",
      id: "e-1",
    });
    expect(parseWikiLinkHref("#sf-link:note:n-1")).toEqual({
      kind: "note",
      id: "n-1",
    });
  });

  it("reads back an unresolved href", () => {
    expect(parseWikiLinkHref("#sf-link:unresolved")).toEqual({
      kind: "unresolved",
    });
  });

  it("returns null for hrefs it does not own", () => {
    expect(parseWikiLinkHref("https://example.com")).toBeNull();
    expect(parseWikiLinkHref("#section")).toBeNull();
  });
});

describe("wikiLinkFor", () => {
  it("pins the target id so the link survives a rename", () => {
    expect(wikiLinkFor("entity", "Carlos Mendoza", "e-1")).toBe(
      "[[Carlos Mendoza|entity:e-1]]",
    );
  });
});
