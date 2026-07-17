import { randomUUID } from "node:crypto";
import { genSaltSync, hashSync } from "bcrypt-ts";

import { prisma } from "../src/client";

const CAMPAIGN_NAME = "The Sunken Spire (seed)";
const SEED_PASSWORD = "password123";

const USERS = {
  gm: { email: "gm@storyforge.dev", role: "OWNER" as const },
  storyteller: {
    email: "storyteller@storyforge.dev",
    role: "STORYTELLER" as const,
  },
  player1: { email: "player1@storyforge.dev", role: "PLAYER" as const },
  player2: { email: "player2@storyforge.dev", role: "PLAYER" as const },
  observer: { email: "observer@storyforge.dev", role: "OBSERVER" as const },
};

function hashPassword(password: string): string {
  return hashSync(password, genSaltSync(10));
}

/**
 * Removes any previous run's data so `pnpm seed` is safe to re-run. Deletes
 * the campaign first (cascades entities/members/tags/relationships/notes/
 * sessions/events), then the seed users themselves — in that order, since
 * User has no cascade *from* Campaign, only CampaignMember does.
 */
async function reset(): Promise<void> {
  await prisma.campaign.deleteMany({ where: { name: CAMPAIGN_NAME } });
  await prisma.user.deleteMany({
    where: { email: { in: Object.values(USERS).map((u) => u.email) } },
  });
}

async function main(): Promise<void> {
  await reset();

  const hashedPassword = hashPassword(SEED_PASSWORD);
  const users = await Promise.all(
    Object.entries(USERS).map(async ([key, { email }]) => {
      const user = await prisma.user.create({
        data: { id: randomUUID(), email, password: hashedPassword },
      });
      return [key, user] as const;
    }),
  ).then(Object.fromEntries);

  const campaign = await prisma.campaign.create({
    data: {
      id: randomUUID(),
      name: CAMPAIGN_NAME,
      description:
        "A drowned tower off the coast of Port Blackwater, said to hold a relic that speaks.",
    },
  });

  await prisma.campaignMember.createMany({
    data: Object.entries(USERS).map(([key, { role }]) => ({
      id: randomUUID(),
      campaignId: campaign.id,
      userId: users[key].id,
      role,
    })),
  });

  const [gruk, whisper, portBlackwater, sunkenSpire, amulet] =
    await Promise.all([
      prisma.entity.create({
        data: {
          id: randomUUID(),
          campaignId: campaign.id,
          type: "npc",
          name: "Gruk the Orc",
          description: "A dockside enforcer with a soft spot for stray cats.",
          visibility: "PUBLIC",
        },
      }),
      prisma.entity.create({
        data: {
          id: randomUUID(),
          campaignId: campaign.id,
          type: "npc",
          name: "Whisper",
          description:
            "A cloaked figure orchestrating the spire's cult from the shadows.",
          visibility: "STORYTELLER",
        },
      }),
      prisma.entity.create({
        data: {
          id: randomUUID(),
          campaignId: campaign.id,
          type: "location",
          name: "Port Blackwater",
          description: "A fog-choked harbor town built on smuggling money.",
          visibility: "PUBLIC",
        },
      }),
      prisma.entity.create({
        data: {
          id: randomUUID(),
          campaignId: campaign.id,
          type: "location",
          name: "The Sunken Spire",
          description: "A half-submerged tower, only reachable at low tide.",
          visibility: "PUBLIC",
        },
      }),
      prisma.entity.create({
        data: {
          id: randomUUID(),
          campaignId: campaign.id,
          type: "item",
          name: "Amulet of Whispers",
          description: "Warm to the touch. It hums when Whisper is near.",
          visibility: "STORYTELLER",
        },
      }),
    ]);

  const [villainTag, allyTag, locationTag, questItemTag] = await Promise.all([
    prisma.tag.create({
      data: { id: randomUUID(), campaignId: campaign.id, name: "villain" },
    }),
    prisma.tag.create({
      data: { id: randomUUID(), campaignId: campaign.id, name: "ally" },
    }),
    prisma.tag.create({
      data: { id: randomUUID(), campaignId: campaign.id, name: "location" },
    }),
    prisma.tag.create({
      data: { id: randomUUID(), campaignId: campaign.id, name: "quest-item" },
    }),
  ]);

  await prisma.entityTag.createMany({
    data: [
      { id: randomUUID(), entityId: gruk.id, tagId: allyTag.id },
      { id: randomUUID(), entityId: whisper.id, tagId: villainTag.id },
      { id: randomUUID(), entityId: portBlackwater.id, tagId: locationTag.id },
      { id: randomUUID(), entityId: sunkenSpire.id, tagId: locationTag.id },
      { id: randomUUID(), entityId: amulet.id, tagId: questItemTag.id },
    ],
  });

  await prisma.relationship.createMany({
    data: [
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: whisper.id,
        targetEntityId: gruk.id,
        type: "ENEMY_OF",
        description: "Whisper considers Gruk a loose end.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: gruk.id,
        targetEntityId: portBlackwater.id,
        type: "MEMBER_OF",
        description: "Gruk works the docks.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: whisper.id,
        targetEntityId: sunkenSpire.id,
        type: "LOCATED_AT",
        description: "Whisper's cult meets here.",
      },
      // Without this edge the amulet was an isolated node in the KAN-42
      // relationship graph — every seeded entity should show up connected.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: amulet.id,
        targetEntityId: whisper.id,
        type: "OWNED_BY",
        description: "The amulet channels Whisper's voice.",
      },
    ],
  });

  const session1 = await prisma.session.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      sessionNumber: 1,
      date: new Date("2026-06-01T19:00:00Z"),
      summary:
        "The party arrived in Port Blackwater and met Gruk at the docks.",
    },
  });

  const event1 = await prisma.event.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      sessionId: session1.id,
      title: "Arrival at Port Blackwater",
      description: "The party's ship docks under a blood-red sunset.",
      occurredAt: "Day 1, dusk",
    },
  });

  await prisma.eventParticipant.createMany({
    data: [
      {
        id: randomUUID(),
        eventId: event1.id,
        entityId: gruk.id,
        role: "witness",
      },
    ],
  });

  const prepNote = await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.gm.id,
      title: "Session 1 prep",
      content:
        "Party lands in [[Port Blackwater]]. [[Gruk the Orc]] offers to guide them to [[The Sunken Spire]] for a price. Do not reveal [[Whisper]] yet.",
      visibility: "PRIVATE",
    },
  });

  await prisma.noteLink.createMany({
    data: [
      {
        id: randomUUID(),
        noteId: prepNote.id,
        targetEntityId: portBlackwater.id,
      },
      { id: randomUUID(), noteId: prepNote.id, targetEntityId: gruk.id },
      { id: randomUUID(), noteId: prepNote.id, targetEntityId: sunkenSpire.id },
      { id: randomUUID(), noteId: prepNote.id, targetEntityId: whisper.id },
    ],
  });

  await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.player1.id,
      parentNoteId: prepNote.id,
      title: "My character's suspicions",
      content:
        "Something about Gruk's story doesn't add up. Keep an eye on him.",
    },
  });

  await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.gm.id,
      title: "Table rules",
      content:
        "We start at 7pm sharp. Snacks rotate alphabetically. No phones during boss fights.",
      visibility: "SHARED",
    },
  });

  const handoutNote = await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.gm.id,
      title: "Handout: the amulet's whisper",
      content:
        'As you touch the [[Amulet of Whispers]], a voice only you can hear says: *"The orc knows the way down."* Share this with the party — or don\'t.',
      visibility: "TARGETED",
      recipients: {
        create: [{ id: randomUUID(), userId: users.player1.id }],
      },
    },
  });

  await prisma.noteLink.create({
    data: {
      id: randomUUID(),
      noteId: handoutNote.id,
      targetEntityId: amulet.id,
    },
  });

  console.log("Seeded campaign:", CAMPAIGN_NAME);
  console.log("Login with any of these (password: %s):", SEED_PASSWORD);
  for (const { email, role } of Object.values(USERS)) {
    console.log(`  ${role.padEnd(14)} ${email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
