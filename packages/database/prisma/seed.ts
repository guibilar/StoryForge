import { randomUUID } from "node:crypto";
import { genSaltSync, hashSync } from "bcrypt-ts";

import { prisma } from "../src/client";
import { EntityCategory } from "../src/generated/prisma/client";

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
 * sessions/events/markers/territories/mapImage/workspaceStates), then the
 * seed users themselves — in that order, since User has no cascade *from*
 * Campaign, only CampaignMember does.
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

  const [
    gruk,
    whisper,
    portBlackwater,
    sunkenSpire,
    amulet,
    tidewatch,
    brineclaw,
    lowTideRite,
  ] = await Promise.all([
    prisma.entity.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        type: "NPC",
        category: EntityCategory.CHARACTER,
        name: "Gruk the Orc",
        description: "A dockside enforcer with a soft spot for stray cats.",
        visibility: "PUBLIC",
      },
    }),
    prisma.entity.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        type: "NPC",
        category: EntityCategory.CHARACTER,
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
        category: EntityCategory.LOCATION,
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
        category: EntityCategory.LOCATION,
        name: "The Sunken Spire",
        description: "A half-submerged tower, only reachable at low tide.",
        visibility: "PUBLIC",
      },
    }),
    prisma.entity.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        category: EntityCategory.ITEM,
        type: "item",
        name: "Amulet of Whispers",
        description: "Warm to the touch. It hums when Whisper is near.",
        visibility: "STORYTELLER",
      },
    }),
    // Types beyond NPC/location/item exist so the sidebar's per-type
    // collapsible groups have more than three groups to exercise.
    prisma.entity.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        type: "faction",
        category: EntityCategory.ORGANIZATION,
        name: "The Tidewatch",
        description:
          "Harbor militia that answers to the harbormaster, and to whoever pays her more.",
        visibility: "PUBLIC",
      },
    }),
    prisma.entity.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        type: "creature",
        category: EntityCategory.OTHER,
        name: "Brineclaw",
        description:
          "The thing that circles the spire at high tide. Nobody has seen all of it at once.",
        visibility: "STORYTELLER",
      },
    }),
    prisma.entity.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        type: "event",
        category: EntityCategory.OTHER,
        name: "The Low-Tide Rite",
        description:
          "Whisper's cult only opens the spire on the lowest tide of the month.",
        visibility: "STORYTELLER",
      },
    }),
  ]);

  const [villainTag, allyTag, locationTag, questItemTag, factionTag] =
    await Promise.all([
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
      prisma.tag.create({
        data: { id: randomUUID(), campaignId: campaign.id, name: "faction" },
      }),
    ]);

  await prisma.entityTag.createMany({
    data: [
      { id: randomUUID(), entityId: gruk.id, tagId: allyTag.id },
      { id: randomUUID(), entityId: whisper.id, tagId: villainTag.id },
      { id: randomUUID(), entityId: portBlackwater.id, tagId: locationTag.id },
      { id: randomUUID(), entityId: sunkenSpire.id, tagId: locationTag.id },
      { id: randomUUID(), entityId: amulet.id, tagId: questItemTag.id },
      { id: randomUUID(), entityId: tidewatch.id, tagId: factionTag.id },
      { id: randomUUID(), entityId: brineclaw.id, tagId: villainTag.id },
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
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: gruk.id,
        targetEntityId: tidewatch.id,
        type: "MEMBER_OF",
        description: "Gruk still draws Tidewatch pay, on paper.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: tidewatch.id,
        targetEntityId: portBlackwater.id,
        type: "LOCATED_AT",
        description: "The Tidewatch barracks sit above the customs house.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: brineclaw.id,
        targetEntityId: sunkenSpire.id,
        type: "LOCATED_AT",
        description: "It never strays far from the spire.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: lowTideRite.id,
        targetEntityId: sunkenSpire.id,
        type: "LOCATED_AT",
        description: "The rite is performed on the spire's flooded steps.",
      },
      // Soft-deleted on purpose: the graph and the relationship lists must
      // both exclude it, and the partial unique index (migration
      // 20260715120000) must still allow an identical live edge to exist.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: whisper.id,
        targetEntityId: tidewatch.id,
        type: "ALLY_OF",
        description: "A pact that fell apart before session 1.",
        deletedAt: new Date("2026-05-20T12:00:00Z"),
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

  const session2 = await prisma.session.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      sessionNumber: 2,
      date: new Date("2026-06-15T19:00:00Z"),
      summary:
        "Low tide exposed the spire's steps. The party interrupted the rite and lost the amulet's trail.",
    },
  });

  await prisma.sessionAttendee.createMany({
    data: [
      { id: randomUUID(), sessionId: session1.id, userId: users.gm.id },
      { id: randomUUID(), sessionId: session1.id, userId: users.player1.id },
      { id: randomUUID(), sessionId: session1.id, userId: users.player2.id },
      // Session 2 has a different roster on purpose — attendance is per
      // session, not a copy of the member list.
      { id: randomUUID(), sessionId: session2.id, userId: users.gm.id },
      { id: randomUUID(), sessionId: session2.id, userId: users.player1.id },
      {
        id: randomUUID(),
        sessionId: session2.id,
        userId: users.storyteller.id,
      },
    ],
  });

  const [event1, event2, event3, event4] = await Promise.all([
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session1.id,
        title: "Arrival at Port Blackwater",
        description: "The party's ship docks under a blood-red sunset.",
        occurredAt: "Day 1, dusk",
      },
    }),
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session1.id,
        title: "The Tidewatch shakedown",
        description:
          "Customs 'inspects' the party's cargo. Gruk waves them through for a cut.",
        occurredAt: "Day 1, night",
      },
    }),
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session2.id,
        title: "The rite interrupted",
        description:
          "The party crashes the Low-Tide Rite. Whisper escapes with the amulet.",
        occurredAt: "Day 14, low tide",
      },
    }),
    // Deliberately session-less: Timeline must render campaign-level
    // backstory events that never happened at a table.
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        title: "The spire sinks",
        description:
          "Sixty years before the campaign, the tower slid into the bay in a single night.",
        occurredAt: "Year -60, unrecorded",
      },
    }),
  ]);

  await prisma.eventParticipant.createMany({
    data: [
      {
        id: randomUUID(),
        eventId: event1.id,
        entityId: gruk.id,
        role: "witness",
      },
      {
        id: randomUUID(),
        eventId: event2.id,
        entityId: gruk.id,
        role: "instigator",
      },
      { id: randomUUID(), eventId: event2.id, entityId: tidewatch.id },
      {
        id: randomUUID(),
        eventId: event3.id,
        entityId: whisper.id,
        role: "celebrant",
      },
      { id: randomUUID(), eventId: event3.id, entityId: amulet.id },
      { id: randomUUID(), eventId: event3.id, entityId: lowTideRite.id },
      { id: randomUUID(), eventId: event4.id, entityId: sunkenSpire.id },
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

  // Note→note link, the other half of NoteLink: everything above only
  // exercises targetEntityId.
  await prisma.noteLink.create({
    data: {
      id: randomUUID(),
      noteId: handoutNote.id,
      targetNoteId: prepNote.id,
    },
  });

  // Map data (KAN-51). Coordinates are geographic because this seed leaves
  // MapImage unset — the map renders on the tile layer around KAN-50's
  // default center ([20, 0], zoom 3). No MapImage row is seeded on purpose:
  // its url has to point at a file LocalImageStore actually wrote under the
  // API's UPLOADS_DIR, and the seed runs from packages/database with no
  // access to that cwd. Upload one through the Maps window to exercise the
  // CRS.Simple path (KAN-52) — note that markers/territories are then read
  // as pixel coordinates, so these will land off-image.
  await prisma.marker.createMany({
    data: [
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: portBlackwater.id,
        name: "Port Blackwater",
        lat: 18.4,
        lng: -6.2,
        description: "Harbor town, customs house, and the Tidewatch barracks.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: sunkenSpire.id,
        name: "The Sunken Spire",
        lat: 16.1,
        lng: -2.8,
        description: "Only reachable on foot at low tide.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: gruk.id,
        name: "Gruk's berth",
        lat: 18.7,
        lng: -5.9,
        description: "Pier 4. He sleeps on the boat more nights than not.",
      },
      // Unlinked on purpose: markers are annotations first, entity pins
      // second, and the popup has to cope with entity being null.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        name: "Wreck field",
        lat: 15.2,
        lng: -4.6,
        description: "Masts break the surface here. Nobody salvages them.",
      },
    ],
  });

  await prisma.territory.createMany({
    data: [
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: portBlackwater.id,
        name: "Blackwater Harbor",
        type: "district",
        // GeoJSON rings are [lng, lat] and must close on their first
        // position — see polygonFrom() in MapCanvas.tsx.
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-7.4, 19.6],
              [-4.8, 19.6],
              [-4.8, 17.4],
              [-7.4, 17.4],
              [-7.4, 19.6],
            ],
          ],
        },
        description: "Everything inside the seawall.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: tidewatch.id,
        name: "Tidewatch patrol line",
        type: "territory",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-8.2, 20.4],
              [-3.2, 20.4],
              [-3.2, 16.6],
              [-8.2, 16.6],
              [-8.2, 20.4],
            ],
          ],
        },
        description: "As far out as the militia will row without extra pay.",
      },
      // Unlinked, and a different shape, so the layer isn't uniform.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        name: "The Drowned Reach",
        type: "region",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-3.6, 17.2],
              [-0.4, 16.4],
              [-1.6, 13.8],
              [-4.8, 14.6],
              [-3.6, 17.2],
            ],
          ],
        },
        description: "Shallow water over what used to be farmland.",
      },
    ],
  });

  // Server-persisted workspace state (KAN-103/104) for the GM only, so the
  // same seed still covers the localStorage-only path for every other login.
  // Keys must match DEFAULT_LAYOUT/window ids in apps/web's windowCatalog.ts,
  // plus `entity:<id>` for dynamic entity windows.
  await prisma.workspaceState.create({
    data: {
      id: randomUUID(),
      userId: users.gm.id,
      campaignId: campaign.id,
      layout: {
        members: { x: 356, y: 24, width: 380, height: 320, hidden: true, z: 1 },
        sessions: {
          x: 24,
          y: 24,
          width: 398,
          height: 340,
          hidden: false,
          z: 2,
        },
        timeline: {
          x: 440,
          y: 24,
          width: 480,
          height: 260,
          hidden: false,
          z: 3,
        },
        notes: { x: 526, y: 362, width: 360, height: 240, hidden: true, z: 1 },
        relationships: {
          x: 130,
          y: 60,
          width: 520,
          height: 420,
          hidden: true,
          z: 1,
        },
        maps: { x: 180, y: 300, width: 560, height: 440, hidden: false, z: 4 },
        [`entity:${whisper.id}`]: {
          x: 700,
          y: 300,
          width: 420,
          height: 360,
          hidden: false,
          z: 5,
        },
      },
      recentEntityIds: [whisper.id, sunkenSpire.id, gruk.id],
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
