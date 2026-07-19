export interface WikiLinkEntity {
  id: string;
  name: string;
}

export interface WikiLinkNote {
  id: string;
  title: string;
}

export interface WikiLinkTargets {
  entities: WikiLinkEntity[];
  notes: WikiLinkNote[];
}

export type WikiLinkHref =
  | { kind: "entity"; id: string }
  | { kind: "note"; id: string }
  | { kind: "unresolved" };

// Mirrors the server's parser (apps/api/.../NoteLinkParser.ts) so what the
// viewer turns into a link is exactly what the API turned into a NoteLink
// row on save. Keep the two in step.
const WIKI_LINK_PATTERN =
  /\[\[\s*([^\]|]+?)\s*(?:\|\s*(entity|note):\s*([^\]]+?)\s*)?\]\]/g;

const HREF_PREFIX = "#sf-link:";

// A fragment href rather than a custom protocol: markdown sanitizers drop
// unknown schemes, and every renderer leaves "#..." alone.
function hrefFor(target: WikiLinkHref): string {
  return target.kind === "unresolved"
    ? `${HREF_PREFIX}unresolved`
    : `${HREF_PREFIX}${target.kind}:${target.id}`;
}

export function parseWikiLinkHref(href: string): WikiLinkHref | null {
  if (!href.startsWith(HREF_PREFIX)) {
    return null;
  }

  const rest = href.slice(HREF_PREFIX.length);
  if (rest === "unresolved") {
    return { kind: "unresolved" };
  }

  const separator = rest.indexOf(":");
  const kind = rest.slice(0, separator);
  const id = rest.slice(separator + 1);

  return kind === "entity" || kind === "note" ? { kind, id } : null;
}

// Resolution order matches NoteLinkResolver: an explicit `|entity:<id>` /
// `|note:<id>` wins, then a same-named entity, then a note title. The
// candidate lists are the links the API already resolved and persisted for
// this note, so a link that renders as live here is one that really exists.
function resolveLink(
  label: string,
  explicitKind: string | undefined,
  explicitId: string | undefined,
  targets: WikiLinkTargets,
): WikiLinkHref {
  if (explicitKind === "entity" && explicitId) {
    const entity = targets.entities.find((item) => item.id === explicitId);
    return entity ? { kind: "entity", id: entity.id } : { kind: "unresolved" };
  }

  if (explicitKind === "note" && explicitId) {
    const note = targets.notes.find((item) => item.id === explicitId);
    return note ? { kind: "note", id: note.id } : { kind: "unresolved" };
  }

  const entity = targets.entities.find((item) => item.name === label);
  if (entity) {
    return { kind: "entity", id: entity.id };
  }

  const note = targets.notes.find((item) => item.title === label);
  return note ? { kind: "note", id: note.id } : { kind: "unresolved" };
}

function escapeLinkText(label: string): string {
  return label.replace(/([\\[\]])/g, "\\$1");
}

/**
 * Rewrites `[[Label]]` references into ordinary markdown links pointing at
 * `#sf-link:` fragments, so the markdown renderer handles them like any
 * other link and the viewer only has to intercept clicks. Unresolvable
 * references still render (dimmed) rather than disappearing, which is how a
 * writer notices a typo'd or not-yet-created target.
 */
export function toMarkdownWithWikiLinks(
  content: string,
  targets: WikiLinkTargets,
): string {
  return content.replace(
    WIKI_LINK_PATTERN,
    (_match, label: string, explicitKind?: string, explicitId?: string) => {
      const target = resolveLink(label, explicitKind, explicitId, targets);
      return `[${escapeLinkText(label)}](${hrefFor(target)})`;
    },
  );
}

/**
 * The text a link picker inserts at the cursor. Ids are pinned so the link
 * survives a later rename of the target.
 */
export function wikiLinkFor(
  kind: "entity" | "note",
  label: string,
  id: string,
): string {
  return `[[${label}|${kind}:${id}]]`;
}
