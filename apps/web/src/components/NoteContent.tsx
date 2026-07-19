import type { MouseEvent } from "react";
import MDEditor from "@uiw/react-md-editor";

import { parseWikiLinkHref, toMarkdownWithWikiLinks } from "../lib/noteLinks";
import type { WikiLinkTargets } from "../lib/noteLinks";
import styles from "./NoteContent.module.css";

export interface NoteContentProps {
  content: string;
  // The links the API resolved for this note — what a `[[reference]]` is
  // matched against. See lib/noteLinks.ts.
  targets: WikiLinkTargets;
  onOpenEntity: (entityId: string) => void;
  onOpenNote: (noteId: string) => void;
}

// Read-only rendering of a note's markdown, with `[[wiki links]]` turned
// into in-app navigation instead of hrefs the browser would follow.
export function NoteContent({
  content,
  targets,
  onOpenEntity,
  onOpenNote,
}: NoteContentProps) {
  const source = toMarkdownWithWikiLinks(content, targets);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest("a");
    const href = anchor?.getAttribute("href");
    if (!href) {
      return;
    }

    const target = parseWikiLinkHref(href);
    if (!target) {
      // An ordinary link in the note body — let the browser have it.
      return;
    }

    // Wiki links are navigation inside the desktop, never a page load, so
    // they never reach the browser even when unresolved.
    event.preventDefault();

    if (target.kind === "entity") {
      onOpenEntity(target.id);
    } else if (target.kind === "note") {
      onOpenNote(target.id);
    }
  }

  return (
    // Click delegation rather than per-anchor handlers: the markdown
    // renderer owns the DOM. Keyboard users are covered because activating
    // a focused anchor with Enter fires a click event that lands here too.
    <div className={styles.content} onClick={handleClick}>
      <MDEditor.Markdown source={source} />
    </div>
  );
}
