import { createYoga } from "graphql-yoga";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import { schema } from "./schema";
import { createContext } from "./context";
import { UPLOADS_DIR } from "../config/env";
import { isUploadsRequest, serveUpload } from "./uploadsStaticHandler";

export const yoga = createYoga({
  schema,
  context: createContext,
});

function requestListener(req: IncomingMessage, res: ServerResponse): void {
  if (req.url && isUploadsRequest(req.url)) {
    serveUpload(req, res, UPLOADS_DIR);
    return;
  }

  yoga(req, res);
}

export const server = createServer(requestListener);
