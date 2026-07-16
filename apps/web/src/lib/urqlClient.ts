import { cacheExchange, createClient, fetchExchange } from "urql";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/graphql";

export const urqlClient = createClient({
  url: API_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: { credentials: "include" },
});
