---
name: jira-ticket
description: >
  Create a Jira ticket on the StoryForge kanban board (project KAN,
  cloudId guibilar.atlassian.net) with a description populated in
  What/Why/How/Expectations format. Use whenever creating any Epic or
  Tarefa (Task) for this project, whether asked directly ("create a
  ticket for X", "add this to the board") or as a natural consequence of
  planning/scoping work that should be tracked.
---

Two-step process, always both steps, never skip the description:

## Step 1 — create the issue

Use `mcp__claude_ai_Atlassian_Rovo__createJiraIssue`:

- `cloudId`: `guibilar.atlassian.net`
- `projectKey`: `KAN`
- `issueTypeName`: `Epic` for a sprint/phase-level grouping, `Tarefa` for a concrete unit of work (this project's Task type is named "Tarefa" in Portuguese, not "Task")
- `parent`: the epic key (e.g. `KAN-6`) when creating a Tarefa under an existing epic
- `summary`: short, no "Sprint N —" prefix (epics were renamed to drop that)

Do not pass `description` here — leave it out, then immediately do step 2. `createJiraIssue`'s description param doesn't reliably apply the four-section format the way an explicit follow-up edit does, and keeping creation/description as two calls matches how this board's tickets were built originally.

## Step 2 — populate the description

Use `mcp__claude_ai_Atlassian_Rovo__editJiraIssue` with `contentFormat: "markdown"` and a `description` field structured as exactly four sections, in this order:

```
**What**
One or two sentences: the concrete deliverable.

**Why**
Motivation grounded in actual repo/architecture state — what breaks or is
blocked without this, referencing real files/patterns (AGENTS.md, existing
modules like EntityService) rather than generic boilerplate.

**How**
Concrete file paths and patterns to mirror (e.g. "same shape as
apps/api/src/modules/entities/application/EntityService.ts"). Call out any
open decision that must be made before implementing (e.g. picking a session
strategy, a GraphQL client) rather than silently assuming one.

**Expectations**
Current status: DONE / NOT STARTED / blocked-on-KAN-XX. Plus a one-line
definition of done.
```

## Status handling

If the work described is already done in the repo (verify by reading the actual code, not assuming), after creating the issue also transition it to Done:

- `mcp__claude_ai_Atlassian_Rovo__getTransitionsForJiraIssue` once per session to confirm the transition id (it's `31` → "Concluído" as of this board's setup, but don't hardcode blindly if the workflow ever changes)
- `mcp__claude_ai_Atlassian_Rovo__transitionJiraIssue` with that id

## Reference

Board structure, epic list, and status IDs are recorded in memory
(`storyforge_jira_kanban` and `feedback_jira_ticket_format`) — check
those first if unsure which epic a new ticket belongs under.
