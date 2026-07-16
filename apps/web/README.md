# @storyforge/web

React frontend for StoryForge, built with Vite.

## Stack

- **GraphQL client**: [urql](https://commerce.nearform.com/open-source/urql/) —
  `src/lib/urqlClient.ts`. Queries/mutations are authored as `.graphql`
  documents under `src/graphql/` and typed via
  [GraphQL Code Generator](https://the-guild.dev/graphql/codegen)'s
  client-preset (`pnpm codegen`), which reads the schema directly from
  `apps/api`'s SDL files and emits `src/gql/`.
- **Router**: [react-router-dom](https://reactrouter.com/) (library mode,
  `createBrowserRouter`) — route tree in `src/routes/routeConfig.tsx`.
  `ProtectedRoute` guards `/dashboard` and `/campaigns/:id`, redirecting to
  `/login` when the `me` query returns `null`.
- **Tests**: [Vitest](https://vitest.dev/) + React Testing Library, jsdom
  environment (config lives in `vite.config.ts`'s `test` block).

## Scripts

- `pnpm dev` — start the Vite dev server
- `pnpm build` — typecheck (`tsc -b`) and build for production
- `pnpm test` — run the test suite
- `pnpm lint` — run ESLint
- `pnpm codegen` — regenerate `src/gql/` from `apps/api`'s GraphQL schema

## Environment

Copy `.env.example` to `.env` and set `VITE_API_URL` to point at a running
`apps/api` GraphQL endpoint (defaults to `http://localhost:4000/graphql` if
unset).
