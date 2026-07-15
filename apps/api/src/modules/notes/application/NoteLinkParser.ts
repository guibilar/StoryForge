export interface ParsedNoteLink {
  label: string;
  explicitTargetType?: "entity" | "note";
  explicitTargetId?: string;
}

const LINK_PATTERN =
  /\[\[\s*([^\]|]+?)\s*(?:\|\s*(entity|note):\s*([^\]]+?)\s*)?\]\]/g;

/**
 * Extracts wiki-style `[[Label]]` / `[[Label|entity:<id>]]` / `[[Label|note:<id>]]`
 * references from Note content. Resolution against real Entities/Notes happens
 * downstream — this only parses the raw syntax.
 */
export function parseNoteLinks(content: string): ParsedNoteLink[] {
  const links: ParsedNoteLink[] = [];

  for (const match of content.matchAll(LINK_PATTERN)) {
    const [, label, explicitTargetType, explicitTargetId] = match;

    links.push({
      label,
      explicitTargetType: explicitTargetType as "entity" | "note" | undefined,
      explicitTargetId,
    });
  }

  return links;
}
