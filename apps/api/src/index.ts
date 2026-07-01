import Fastify from "fastify";
import { prisma } from "@storyforge/database";

const app = Fastify();

app.get("/", async () => {
    return { status: "ok" };
});

app.listen({
    port: 4000
});