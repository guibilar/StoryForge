import { server } from "./graphql/server";

const PORT = 4000;

server.listen(PORT, () => {
  console.log(
    `🚀 StoryForge GraphQL Server running at http://localhost:${PORT}/graphql`,
  );
});
