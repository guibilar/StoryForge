import { createYoga } from "graphql-yoga";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

import { schema } from "./schema";
import { createContext } from "./context";
import { UPLOADS_DIR, WEB_ORIGIN } from "../config/env";
import { isUploadsRequest, serveUpload } from "./uploadsStaticHandler";

export const yoga = createYoga<{ req: IncomingMessage; res: ServerResponse }>({
  schema,
  context: createContext,
  cors: {
    origin: WEB_ORIGIN,
    credentials: true,
  },
});

function requestListener(req: IncomingMessage, res: ServerResponse): void {
  if (req.url && isUploadsRequest(req.url)) {
    serveUpload(req, res, UPLOADS_DIR).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end("Internal server error");
    });
    return;
  }

  yoga(req, res);
}

export const server = createServer(requestListener);
