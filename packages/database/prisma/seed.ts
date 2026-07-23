import { randomUUID } from "node:crypto";
import { genSaltSync, hashSync } from "bcrypt-ts";

import { prisma } from "../src/client";
import { EntityCategory } from "../src/generated/prisma/client";

const CAMPAIGN_NAME = "The Ashport Chronicle (seed)";
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

interface EntityDef {
  key: string;
  type: string;
  category: EntityCategory;
  name: string;
  description: string;
  visibility: "PUBLIC" | "STORYTELLER";
}

// A modern-nights Vampire: the Masquerade chronicle — a fragile Camarilla
// Prince, a Wharf full of Anarchs who stopped waiting for him to die of old
// age, and a Sabbat mole nobody's caught yet. Big enough a cast to exercise
// every Entity category (CHARACTER/LOCATION/ORGANIZATION/ITEM/OTHER), both
// visibility levels, and — the point of this rewrite — KAN-134's concealed-
// relationship-endpoint feature on a mystery that's still unsolved as of
// session 3 (see the ADVISES/SUSPECTS relationships below).
const ENTITY_DEFS: EntityDef[] = [
  // Locations
  {
    key: "ashport",
    type: "city",
    category: EntityCategory.LOCATION,
    name: "Ashport",
    description:
      "A rust-belt river city the Camarilla have held since the 1920s. The fog off the water hides more than the weather does.",
    visibility: "PUBLIC",
  },
  {
    key: "velvetHour",
    type: "elysium",
    category: EntityCategory.LOCATION,
    name: "The Velvet Hour",
    description:
      "A converted opera house on neutral ground. Elysium law is absolute inside its doors — draw blood here and the Prince decides your fate personally.",
    visibility: "PUBLIC",
  },
  {
    key: "chantry",
    type: "chantry",
    category: EntityCategory.LOCATION,
    name: "The Chantry of Ashport",
    description:
      "Tremere stronghold behind a defunct law office on Cabot Street. The wards keep out anyone the Regent hasn't named.",
    visibility: "PUBLIC",
  },
  {
    key: "wharfDistrict",
    type: "district",
    category: EntityCategory.LOCATION,
    name: "The Wharf District",
    description:
      "Warehouses and squats along the river. Camarilla law gets thin the closer you get to the water.",
    visibility: "PUBLIC",
  },
  {
    key: "rookery",
    type: "warren",
    category: EntityCategory.LOCATION,
    name: "The Rookery",
    description:
      "A flooded stretch of storm drain beneath the Wharf. Nobody finds it who isn't led there.",
    visibility: "STORYTELLER",
  },

  // Sects
  {
    key: "camarilla",
    type: "sect",
    category: EntityCategory.ORGANIZATION,
    name: "The Camarilla",
    description:
      "The old order. Six traditions, a Prince, and a city that mostly still listens.",
    visibility: "PUBLIC",
  },
  {
    key: "anarchMovement",
    type: "sect",
    category: EntityCategory.ORGANIZATION,
    name: "The Anarch Movement",
    description:
      "Kindred who stopped waiting for elders to die of natural causes. Loudest in the Wharf.",
    visibility: "PUBLIC",
  },
  {
    key: "sabbat",
    type: "sect",
    category: EntityCategory.ORGANIZATION,
    name: "The Sabbat",
    description:
      "A war-cult on the county line, by reputation only — Ashport hasn't seen an open incursion in a generation. That's either good news or very bad news.",
    visibility: "PUBLIC",
  },

  // Clans
  {
    key: "clanVentrue",
    type: "clan",
    category: EntityCategory.ORGANIZATION,
    name: "Clan Ventrue",
    description:
      "Blue bloods and bankers. Provides the city its Princes more often than not, and reminds everyone of it.",
    visibility: "PUBLIC",
  },
  {
    key: "clanToreador",
    type: "clan",
    category: EntityCategory.ORGANIZATION,
    name: "Clan Toreador",
    description:
      "Artists, socialites, and the keepers of Elysium's unwritten rules.",
    visibility: "PUBLIC",
  },
  {
    key: "clanBrujah",
    type: "clan",
    category: EntityCategory.ORGANIZATION,
    name: "Clan Brujah",
    description:
      "Idealists who argue with their fists. Split down the middle between Camarilla loyalists and the Anarch line.",
    visibility: "PUBLIC",
  },
  {
    key: "clanNosferatu",
    type: "clan",
    category: EntityCategory.ORGANIZATION,
    name: "Clan Nosferatu",
    description:
      "Unseen and unbothered by it. If it happened in Ashport, a Nosferatu already knows.",
    visibility: "PUBLIC",
  },
  {
    key: "clanTremere",
    type: "clan",
    category: EntityCategory.ORGANIZATION,
    name: "Clan Tremere",
    description:
      "Blood sorcerers who trade favors like currency and never, ever forget a debt.",
    visibility: "PUBLIC",
  },
  {
    key: "clanMalkavian",
    type: "clan",
    category: EntityCategory.ORGANIZATION,
    name: "Clan Malkavian",
    description:
      "Touched by something none of the other clans have a word for. Ashport's Primogen council keeps one seated for a reason.",
    visibility: "PUBLIC",
  },
  {
    key: "clanGangrel",
    type: "clan",
    category: EntityCategory.ORGANIZATION,
    name: "Clan Gangrel",
    description:
      "Left the Camarilla's table decades ago and never came back to it. Still welcome inside the city walls — mostly.",
    visibility: "PUBLIC",
  },

  // Characters
  {
    key: "adrianVoss",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Adrian Voss",
    description:
      "Seventh generation, forty years on the throne. Keeps the Masquerade tighter than any Prince before him — some say too tight.",
    visibility: "PUBLIC",
  },
  {
    key: "seraphineDuval",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Seraphine Duval",
    description:
      "Runs the Velvet Hour and the city's opinion of you, in that order. Nothing happens in Elysium she doesn't hear about first.",
    visibility: "PUBLIC",
  },
  {
    key: "marcusOkafor",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Marcus Okafor",
    description:
      "Calls himself Baron of the Wharf. The Prince calls him a problem that hasn't gotten bad enough to solve yet.",
    visibility: "PUBLIC",
  },
  {
    key: "cassiusThorne",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Cassius Thorne",
    description:
      "Older than his composure lets on. Every favor the Chantry calls in traces back to a ledger only he reads.",
    visibility: "PUBLIC",
  },
  {
    key: "opheliaRask",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Ophelia Rask",
    description:
      "Says true things in the wrong order, at the wrong time, to the wrong person. Everyone still listens.",
    visibility: "PUBLIC",
  },
  {
    key: "nadiaKess",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Nadia Kess",
    description:
      "Comes and goes from the city on her own schedule. Answers to the Prince because it's convenient, not because she has to.",
    visibility: "PUBLIC",
  },
  {
    key: "grimsby",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Grimsby",
    description:
      "Hasn't been seen above ground by anyone outside his clan in a decade. Everyone still takes his calls.",
    visibility: "PUBLIC",
  },
  {
    key: "damonReyes",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Damon Reyes",
    description:
      "Enforces the Prince's law with a temper the Prince finds useful.",
    visibility: "PUBLIC",
  },
  // STORYTELLER on purpose: the whole point of this cast is a mystery a
  // player can chase through a *visible* relationship (see ADVISES/
  // SUSPECTS below) without the entity behind it ever showing up in their
  // own entity list — the KAN-134 use case this seed exists to demonstrate.
  {
    key: "julianMarrow",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Julian Marrow",
    description:
      "Ventrue advisor sitting close enough to the Prince's ear to have shaped half his policy this decade. Feeds a Sabbat contact everything the Prince decides before he's finished deciding it.",
    visibility: "STORYTELLER",
  },
  {
    key: "bishopVane",
    type: "npc",
    category: EntityCategory.CHARACTER,
    name: "Bishop Vane",
    description:
      "A Sabbat Bishop operating alone inside Camarilla territory, in violation of every truce that's supposed to prevent exactly this. Marrow is his only contact in the city.",
    visibility: "STORYTELLER",
  },

  // Item
  {
    key: "grimoire",
    type: "item",
    category: EntityCategory.ITEM,
    name: "Cassius's Grimoire",
    description:
      "A working ledger of blood sorcery favors, written in a cipher only the Chantry can read. Worth more than the building it's kept in.",
    visibility: "STORYTELLER",
  },

  // Other — a custom, campaign-defined concept, same slot the old fantasy
  // seed used for "The Low-Tide Rite": a thing worth relating to and citing
  // from notes/events, but not a place, person, faction, or item.
  {
    key: "riteOfFirstBlood",
    type: "ritual",
    category: EntityCategory.OTHER,
    name: "The Rite of First Blood",
    description:
      "How the Camarilla presents a newly Embraced Kindred to the Prince and the Primogen council. Skipping it is a fast way to become nobody's problem, permanently.",
    visibility: "PUBLIC",
  },
];

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
        "A modern-nights chronicle of Kindred politics in the city of Ashport — a fragile Camarilla Prince, a rising Anarch movement, and something wearing a Sabbat's teeth creeping in from the county line.",
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

  const createdEntities = await Promise.all(
    ENTITY_DEFS.map((def) =>
      prisma.entity.create({
        data: {
          id: randomUUID(),
          campaignId: campaign.id,
          type: def.type,
          category: def.category,
          name: def.name,
          description: def.description,
          visibility: def.visibility,
        },
      }),
    ),
  );
  const entities = Object.fromEntries(
    ENTITY_DEFS.map((def, index) => [def.key, createdEntities[index]]),
  );

  const [
    primogenTag,
    anarchTag,
    camarillaLoyalistTag,
    threatTag,
    questItemTag,
  ] = await Promise.all([
    prisma.tag.create({
      data: { id: randomUUID(), campaignId: campaign.id, name: "primogen" },
    }),
    prisma.tag.create({
      data: { id: randomUUID(), campaignId: campaign.id, name: "anarch" },
    }),
    prisma.tag.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        name: "camarilla-loyalist",
      },
    }),
    prisma.tag.create({
      data: { id: randomUUID(), campaignId: campaign.id, name: "threat" },
    }),
    prisma.tag.create({
      data: { id: randomUUID(), campaignId: campaign.id, name: "quest-item" },
    }),
  ]);

  await prisma.entityTag.createMany({
    data: [
      {
        id: randomUUID(),
        entityId: entities.seraphineDuval.id,
        tagId: primogenTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.cassiusThorne.id,
        tagId: primogenTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.opheliaRask.id,
        tagId: primogenTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.grimsby.id,
        tagId: primogenTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.marcusOkafor.id,
        tagId: anarchTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.anarchMovement.id,
        tagId: anarchTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.adrianVoss.id,
        tagId: camarillaLoyalistTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.damonReyes.id,
        tagId: camarillaLoyalistTag.id,
      },
      { id: randomUUID(), entityId: entities.sabbat.id, tagId: threatTag.id },
      {
        id: randomUUID(),
        entityId: entities.bishopVane.id,
        tagId: threatTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.julianMarrow.id,
        tagId: threatTag.id,
      },
      {
        id: randomUUID(),
        entityId: entities.grimoire.id,
        tagId: questItemTag.id,
      },
    ],
  });

  // The two relationships that need something back after they're created
  // (a RelationshipRecipient row, and the concealed-endpoint duo the whole
  // rewrite exists to demonstrate) get their ids pre-generated here so the
  // rest of the batch can still go through one createMany call below.
  const confidesInId = randomUUID();

  await prisma.relationship.createMany({
    data: [
      // --- Clan membership and council seats ---
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.adrianVoss.id,
        targetEntityId: entities.clanVentrue.id,
        type: "MEMBER_OF",
        description:
          "Seventh generation Ventrue, and proud of the distance that puts between him and the fledgling seat.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.adrianVoss.id,
        targetEntityId: entities.camarilla.id,
        type: "RULES",
        description:
          "Prince of Ashport by right of the Traditions, forty years running.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.seraphineDuval.id,
        targetEntityId: entities.clanToreador.id,
        type: "MEMBER_OF",
        description:
          "Toreador to the bone — she'd say the same about the city.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.seraphineDuval.id,
        targetEntityId: entities.clanToreador.id,
        type: "PRIMOGEN_OF",
        description:
          "Holds Toreador's seat on the Primogen council, and the gavel more often than not.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.marcusOkafor.id,
        targetEntityId: entities.clanBrujah.id,
        type: "MEMBER_OF",
        description: "Brujah, and never lets anyone forget it mid-argument.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.marcusOkafor.id,
        targetEntityId: entities.anarchMovement.id,
        type: "LEADS",
        description:
          "Self-declared Baron of the Wharf. Nobody's successfully un-declared him yet.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.cassiusThorne.id,
        targetEntityId: entities.clanTremere.id,
        type: "MEMBER_OF",
        description:
          "Tremere, third rank at last count — he stopped correcting people who assumed higher.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.cassiusThorne.id,
        targetEntityId: entities.clanTremere.id,
        type: "REGENT_OF",
        description: "Runs the Ashport Chantry in the Council of Seven's name.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.opheliaRask.id,
        targetEntityId: entities.clanMalkavian.id,
        type: "MEMBER_OF",
        description:
          "Malkavian. Ask her what that means and get three true answers.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.opheliaRask.id,
        targetEntityId: entities.clanMalkavian.id,
        type: "PRIMOGEN_OF",
        description:
          "Holds the council's Malkavian seat, whether or not the seat wants holding.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.nadiaKess.id,
        targetEntityId: entities.clanGangrel.id,
        type: "MEMBER_OF",
        description:
          "Gangrel, and about as tied to any one address as the weather is.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.grimsby.id,
        targetEntityId: entities.clanNosferatu.id,
        type: "MEMBER_OF",
        description:
          "Nosferatu. Nobody's actually seen his face in a decade, primogen seat or not.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.grimsby.id,
        targetEntityId: entities.clanNosferatu.id,
        type: "PRIMOGEN_OF",
        description:
          "Holds the Nosferatu seat by proxy more often than in person.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.damonReyes.id,
        targetEntityId: entities.clanBrujah.id,
        type: "MEMBER_OF",
        description: "Brujah, same as the Baron who made him.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.damonReyes.id,
        targetEntityId: entities.adrianVoss.id,
        type: "SERVES",
        description:
          "Sheriff, sworn to enforce the Prince's law — and his temper.",
      },

      // --- Clan/sect allegiance ---
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.clanVentrue.id,
        targetEntityId: entities.camarilla.id,
        type: "MEMBER_OF",
        description:
          "Provides more of the city's Princes than any other clan, and reminds everyone of it.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.clanToreador.id,
        targetEntityId: entities.camarilla.id,
        type: "MEMBER_OF",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.clanTremere.id,
        targetEntityId: entities.camarilla.id,
        type: "MEMBER_OF",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.clanMalkavian.id,
        targetEntityId: entities.camarilla.id,
        type: "MEMBER_OF",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.clanNosferatu.id,
        targetEntityId: entities.camarilla.id,
        type: "MEMBER_OF",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.clanBrujah.id,
        targetEntityId: entities.camarilla.id,
        type: "SPLIT_BETWEEN",
        description:
          "Half the clan still sits Primogen; the other half answers to the Baron instead.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.clanBrujah.id,
        targetEntityId: entities.anarchMovement.id,
        type: "SPLIT_BETWEEN",
        description:
          "The half that stopped waiting for elders to die of natural causes.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.clanGangrel.id,
        targetEntityId: entities.camarilla.id,
        type: "ENEMY_OF",
        description:
          "Left the Traditions when the Ashport Accord collapsed. The Prince still lets them cross his territory — for now.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.sabbat.id,
        targetEntityId: entities.camarilla.id,
        type: "ENEMY_OF",
        description:
          "A war-cult on the county line, by reputation only. Ashport hasn't seen an open incursion in a generation.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.anarchMovement.id,
        targetEntityId: entities.camarilla.id,
        type: "RIVAL_OF",
        description: "Loudest in the Wharf, and getting louder.",
      },

      // --- Locations ---
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.camarilla.id,
        targetEntityId: entities.ashport.id,
        type: "LOCATED_AT",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.anarchMovement.id,
        targetEntityId: entities.wharfDistrict.id,
        type: "LOCATED_AT",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.velvetHour.id,
        targetEntityId: entities.ashport.id,
        type: "LOCATED_AT",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.chantry.id,
        targetEntityId: entities.ashport.id,
        type: "LOCATED_AT",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.chantry.id,
        targetEntityId: entities.clanTremere.id,
        type: "OWNED_BY",
        description:
          "The building answers to the Council of Seven; the Regent just holds the keys.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.velvetHour.id,
        targetEntityId: entities.seraphineDuval.id,
        type: "OWNED_BY",
        description: "Neutral ground, run at her personal discretion.",
      },
      // Storyteller-only on the relationship itself, on top of both
      // endpoints already being STORYTELLER-visibility entities — the
      // relationship's own level and the endpoint rule are independent
      // gates (RelationshipAccess.ts), and this pair deliberately trips
      // both rather than relying on just one.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.rookery.id,
        targetEntityId: entities.wharfDistrict.id,
        type: "LOCATED_AT",
        description: "A flooded storm drain nobody official has mapped.",
        visibility: "STORYTELLER",
      },

      // --- Personal and secret ---
      // Two distinct edges between the same pair — a sire/childe bond isn't
      // the same fact as the resentment it caused, and the relationship
      // graph doesn't need to collapse them into one row.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.damonReyes.id,
        targetEntityId: entities.marcusOkafor.id,
        type: "EMBRACED_BY",
        description:
          "His sire. Neither of them brings it up in front of the Primogen council.",
        visibility: "STORYTELLER",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.damonReyes.id,
        targetEntityId: entities.marcusOkafor.id,
        type: "RESENTS",
        description:
          "Being made Brujah by the Baron and then made Sheriff by the Prince put him at odds with himself before anyone else got the chance.",
        visibility: "STORYTELLER",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.seraphineDuval.id,
        targetEntityId: entities.marcusOkafor.id,
        type: "RIVAL_OF",
        description:
          "Camarilla's harpy and the Wharf's Baron. Every party they're both invited to is a proxy fight.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.cassiusThorne.id,
        targetEntityId: entities.grimoire.id,
        type: "OWNS",
        description:
          "The ledger of every blood-sorcery favor the Chantry's ever called in. He never lets it out of the building.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.riteOfFirstBlood.id,
        targetEntityId: entities.velvetHour.id,
        type: "LOCATED_AT",
        description:
          "Performed on Elysium ground, in front of whoever the Prince wants watching.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.riteOfFirstBlood.id,
        targetEntityId: entities.adrianVoss.id,
        type: "PRESIDED_BY",
        description:
          "The Prince presents every fledgling personally. It's the one tradition he's never delegated.",
      },

      // --- KAN-134 showcase: a mystery a player can find through a visible
      // relationship without the entity behind it ever appearing in their
      // own entity list. Both id and both directions are exercised —
      // concealedEndpoint SOURCE hides who's doing the advising, TARGET
      // hides who the Sheriff is looking for. The description text on both
      // rows is deliberately written to stay non-spoiler even though it's
      // shown alongside the redacted id.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.julianMarrow.id,
        targetEntityId: entities.adrianVoss.id,
        type: "ADVISES",
        description:
          "Someone close to the Prince passes information nobody authorized them to share.",
        concealedEndpoint: "SOURCE",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.damonReyes.id,
        targetEntityId: entities.bishopVane.id,
        type: "SUSPECTS",
        description:
          "The Sheriff knows someone from outside the city has been in Ashport longer than they should've. He hasn't found them yet.",
        concealedEndpoint: "TARGET",
      },
      // No concealedEndpoint needed here — both entities are already
      // STORYTELLER-visibility, so the ordinary endpoint rule hides this
      // one completely on its own. Contrast with the two rows above, where
      // concealment is what keeps a relationship touching a hidden entity
      // from disappearing outright.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.julianMarrow.id,
        targetEntityId: entities.bishopVane.id,
        type: "BLOOD_BOUND_TO",
        description:
          "Vane's price for silence. Marrow drinks it monthly and doesn't remember agreeing to the first taste.",
        visibility: "STORYTELLER",
      },

      // Visible only to player1's character — the other half of KAN-41's
      // TARGETED level, mirrored from the old seed's note-recipient example
      // but on a relationship instead.
      {
        id: confidesInId,
        campaignId: campaign.id,
        sourceEntityId: entities.nadiaKess.id,
        targetEntityId: entities.opheliaRask.id,
        type: "CONFIDES_IN",
        description:
          "Nadia trusts the mad prophet with things she won't tell the Prince.",
        visibility: "TARGETED",
      },

      // Soft-deleted on purpose: the graph and the relationship lists must
      // both exclude it, and the partial unique index (migration
      // 20260715120000) must still allow an identical live edge to exist.
      // This is the Ashport Accord the ENEMY_OF/SPLIT_BETWEEN rows above
      // all refer back to — a dead alliance, not a rumor.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        sourceEntityId: entities.camarilla.id,
        targetEntityId: entities.anarchMovement.id,
        type: "ALLY_OF",
        description: "The Ashport Accord, before it collapsed.",
        deletedAt: new Date("2020-03-01T00:00:00Z"),
      },
    ],
  });

  await prisma.relationshipRecipient.create({
    data: {
      id: randomUUID(),
      relationshipId: confidesInId,
      userId: users.player1.id,
    },
  });

  const session1 = await prisma.session.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      sessionNumber: 1,
      date: new Date("2026-06-01T19:00:00Z"),
      summary:
        "The coterie is Embraced and immediately hauled before Adrian Voss for the Rite of First Blood. Seraphine Duval decides they're interesting. Damon Reyes decides they're a liability.",
    },
  });

  const session2 = await prisma.session.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      sessionNumber: 2,
      date: new Date("2026-06-15T19:00:00Z"),
      summary:
        "Marcus Okafor offers the coterie a job the Prince would never approve of. Nadia Kess warns them the fog off the river has been wrong lately — like something's been let back in.",
    },
  });

  const session3 = await prisma.session.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      sessionNumber: 3,
      date: new Date("2026-06-29T19:00:00Z"),
      summary:
        "A Camarilla courier turns to ash mid-sentence delivering a message meant for the Prince. Someone already inside Elysium knew what it said before she did.",
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
      { id: randomUUID(), sessionId: session3.id, userId: users.gm.id },
      { id: randomUUID(), sessionId: session3.id, userId: users.player1.id },
      { id: randomUUID(), sessionId: session3.id, userId: users.player2.id },
      {
        id: randomUUID(),
        sessionId: session3.id,
        userId: users.storyteller.id,
      },
    ],
  });

  const [
    ,
    riteEvent,
    baronOfferEvent,
    fogWarningEvent,
    ashOnDoorstepEvent,
    whispersEvent,
    accordSignedEvent,
    accordCollapsedEvent,
  ] = await Promise.all([
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session1.id,
        title: "The Embrace",
        description:
          "Four strangers wake up as something other than human, in a city that already has rules for what they're allowed to do next.",
        occurredAt: "Night 1",
      },
    }),
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session1.id,
        title: "Presented at the Velvet Hour",
        description:
          "The Rite of First Blood, performed in full view of the Primogen council.",
        occurredAt: "Night 1, later",
      },
    }),
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session2.id,
        title: "The Baron's offer",
        description:
          "Marcus Okafor asks the coterie to relocate a shipment the Camarilla customs house was never meant to find.",
        occurredAt: "Night 9",
      },
    }),
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session2.id,
        title: "A warning in the fog",
        description:
          "Nadia Kess corners them near the waterline. Something about the city's edges doesn't smell right to her anymore.",
        occurredAt: "Night 9, later",
      },
    }),
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session3.id,
        title: "Ash on the doorstep",
        description:
          "A courier bound for the Prince's chambers combusts three words into her message. Nobody claims to know why.",
        occurredAt: "Night 22",
      },
    }),
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        sessionId: session3.id,
        title: "Whispers in Elysium",
        description:
          "Someone in the room already knew what the courier died carrying. The coterie just has to figure out who.",
        occurredAt: "Night 22, later",
      },
    }),
    // Deliberately session-less: Timeline must render campaign-level
    // backstory events that never happened at a table.
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        title: "The Ashport Accord signed",
        description:
          "The Camarilla and the newly-organized Anarch Movement agree to share the city rather than burn it down fighting over it. It holds for two generations.",
        occurredAt: "50 years before present",
      },
    }),
    prisma.event.create({
      data: {
        id: randomUUID(),
        campaignId: campaign.id,
        title: "The Accord collapses",
        description:
          "A dispute over Wharf feeding grounds ends the truce. The Gangrel leave the Primogen table within the month and never come back to it.",
        occurredAt: "6 years before present",
      },
    }),
  ]);

  await prisma.eventParticipant.createMany({
    data: [
      {
        id: randomUUID(),
        eventId: riteEvent.id,
        entityId: entities.adrianVoss.id,
        role: "host",
      },
      {
        id: randomUUID(),
        eventId: riteEvent.id,
        entityId: entities.seraphineDuval.id,
        role: "witness",
      },
      {
        id: randomUUID(),
        eventId: riteEvent.id,
        entityId: entities.riteOfFirstBlood.id,
      },
      {
        id: randomUUID(),
        eventId: riteEvent.id,
        entityId: entities.velvetHour.id,
      },
      {
        id: randomUUID(),
        eventId: baronOfferEvent.id,
        entityId: entities.marcusOkafor.id,
        role: "instigator",
      },
      {
        id: randomUUID(),
        eventId: baronOfferEvent.id,
        entityId: entities.wharfDistrict.id,
      },
      {
        id: randomUUID(),
        eventId: fogWarningEvent.id,
        entityId: entities.nadiaKess.id,
        role: "informant",
      },
      {
        id: randomUUID(),
        eventId: ashOnDoorstepEvent.id,
        entityId: entities.adrianVoss.id,
        role: "witness",
      },
      {
        id: randomUUID(),
        eventId: whispersEvent.id,
        entityId: entities.seraphineDuval.id,
        role: "host",
      },
      {
        id: randomUUID(),
        eventId: whispersEvent.id,
        entityId: entities.velvetHour.id,
      },
      {
        id: randomUUID(),
        eventId: accordSignedEvent.id,
        entityId: entities.camarilla.id,
      },
      {
        id: randomUUID(),
        eventId: accordSignedEvent.id,
        entityId: entities.anarchMovement.id,
      },
      {
        id: randomUUID(),
        eventId: accordCollapsedEvent.id,
        entityId: entities.anarchMovement.id,
      },
      {
        id: randomUUID(),
        eventId: accordCollapsedEvent.id,
        entityId: entities.clanGangrel.id,
      },
      {
        id: randomUUID(),
        eventId: accordCollapsedEvent.id,
        entityId: entities.camarilla.id,
      },
      // "The Embrace" (first in the array above) gets no participants — the
      // coterie itself isn't seeded as entities (they're the players' own
      // PCs, created at the table).
    ],
  });

  const prepNote = await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.gm.id,
      title: "Session 1 prep",
      content:
        "The coterie wakes in [[The Velvet Hour]]'s cellar. [[Adrian Voss]] presides over [[The Rite of First Blood]]. [[Seraphine Duval]] takes an interest immediately — play that up. Don't reveal [[Julian Marrow]] is anyone's advisor yet; that's a session 3+ thread.",
      visibility: "PRIVATE",
    },
  });

  await prisma.noteLink.createMany({
    data: [
      {
        id: randomUUID(),
        noteId: prepNote.id,
        targetEntityId: entities.velvetHour.id,
      },
      {
        id: randomUUID(),
        noteId: prepNote.id,
        targetEntityId: entities.adrianVoss.id,
      },
      {
        id: randomUUID(),
        noteId: prepNote.id,
        targetEntityId: entities.riteOfFirstBlood.id,
      },
      {
        id: randomUUID(),
        noteId: prepNote.id,
        targetEntityId: entities.seraphineDuval.id,
      },
      // A GM-only note can safely link a STORYTELLER-visibility entity —
      // PRIVATE keeps the note itself to storyteller-tier readers, same
      // gate the entity already sits behind.
      {
        id: randomUUID(),
        noteId: prepNote.id,
        targetEntityId: entities.julianMarrow.id,
      },
    ],
  });

  await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.player1.id,
      parentNoteId: prepNote.id,
      title: "My character's read on the room",
      content:
        "Seraphine's too interested in us. Nobody that important pays attention to fledglings for free.",
    },
  });

  await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.gm.id,
      title: "Table rules",
      content:
        "We start at 8pm. XP splits evenly regardless of attendance — nobody's punished for a scheduling conflict. Ask before doing anything that breaks the Masquerade in a way I can't walk back.",
      visibility: "SHARED",
    },
  });

  await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.storyteller.id,
      title: "City history, the short version",
      content:
        "[[The Camarilla]] and [[The Anarch Movement]] used to share the city on paper. [[Clan Gangrel]] didn't wait around to see if paper meant anything — ask [[Nadia Kess]] about it if you want the version that isn't in the official record.",
      visibility: "SHARED",
    },
  });

  // TARGETED handout, visible only to player1 and storyteller-tier — the
  // note names Julian Marrow in plain text (a real clue for player1's
  // character), but the entity behind that name stays STORYTELLER-only:
  // clicking through from the note fails exactly the way it should until
  // the Storyteller reveals him for real.
  const handoutNote = await prisma.note.create({
    data: {
      id: randomUUID(),
      campaignId: campaign.id,
      authorId: users.gm.id,
      title: "Handout: what the courier said",
      content:
        'In the half-second before she burned, the courier\'s last coherent word to you — and only you — was: *"Marrow."* Do with that what you will.',
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
      targetEntityId: entities.julianMarrow.id,
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
        entityId: entities.velvetHour.id,
        name: "The Velvet Hour",
        lat: 18.4,
        lng: -6.2,
        description: "Elysium. The one place in Ashport nobody draws blood.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: entities.chantry.id,
        name: "The Chantry of Ashport",
        lat: 18.9,
        lng: -6.6,
        description: "Behind a defunct law office on Cabot Street.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: entities.marcusOkafor.id,
        name: "Marcus Okafor's squat",
        lat: 16.1,
        lng: -3.1,
        description: "A gutted cannery. He holds court on the loading dock.",
      },
      // Unlinked on purpose: markers are annotations first, entity pins
      // second, and the popup has to cope with entity being null.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        name: "The old toll bridge",
        lat: 15.4,
        lng: -4.4,
        description:
          "Nobody's driven across it since the Accord collapsed. The Anarchs use the girders for something at night.",
      },
    ],
  });

  await prisma.territory.createMany({
    data: [
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: entities.ashport.id,
        name: "Ashport city limits",
        type: "city",
        // GeoJSON rings are [lng, lat] and must close on their first
        // position — see polygonFrom() in MapCanvas.tsx.
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-7.4, 19.6],
              [-2.4, 19.6],
              [-2.4, 13.4],
              [-7.4, 13.4],
              [-7.4, 19.6],
            ],
          ],
        },
        description: "Everything the Camarilla still claims to hold.",
      },
      {
        id: randomUUID(),
        campaignId: campaign.id,
        entityId: entities.wharfDistrict.id,
        name: "The Wharf",
        type: "district",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-4.8, 17.6],
              [-2.6, 17.6],
              [-2.6, 15.0],
              [-4.8, 15.0],
              [-4.8, 17.6],
            ],
          ],
        },
        description: "Camarilla law gets thin the closer you get to the water.",
      },
      // Unlinked, and a different shape, so the layer isn't uniform.
      {
        id: randomUUID(),
        campaignId: campaign.id,
        name: "The Shroud",
        type: "region",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-3.6, 15.2],
              [-0.8, 14.6],
              [-1.8, 12.4],
              [-4.4, 13.0],
              [-3.6, 15.2],
            ],
          ],
        },
        description: "Fog that doesn't lift on its own schedule.",
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
        [`entity:${entities.adrianVoss.id}`]: {
          x: 700,
          y: 300,
          width: 420,
          height: 360,
          hidden: false,
          z: 5,
        },
      },
      // The GM's own recents, including a STORYTELLER-visibility entity —
      // recentEntityIds is per-user prep history, not a player-facing list.
      recentEntityIds: [
        entities.julianMarrow.id,
        entities.seraphineDuval.id,
        entities.adrianVoss.id,
      ],
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
