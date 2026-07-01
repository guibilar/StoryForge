import { createYoga } from "graphql-yoga";
import { createServer } from "node:http";

import { schema } from "./schema";
import { createContext } from "./context";

export const yoga = createYoga({
    schema,
    context: createContext,
});

export const server = createServer(yoga);