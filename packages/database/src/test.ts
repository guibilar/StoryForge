import { prisma } from "./client";

async function main() {
  const result = await prisma.$queryRaw`SELECT 1`;

  console.log(result);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
