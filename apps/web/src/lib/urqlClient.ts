import { cacheExchange, createClient, fetchExchange } from "urql";

export const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000/graphql";

export const urqlClient = createClient({
  url: API_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: { credentials: "include" },
  // graphql-yoga serves subscriptions as `text/event-stream` (SSE) responses
  // over the same HTTP endpoint used for queries/mutations — no separate
  // WebSocket transport or exchange is needed. See KAN-127.
  fetchSubscriptions: true,
});
