import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "urql";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { Button, Icon, Select } from "@storyforge/ui";

import {
  CampaignDocument,
  EntitiesDocument,
  MeDocument,
  RelationshipsDocument,
} from "../gql/graphql";
import { useAddEditWindow } from "../hooks/useAddEditWindow";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { buildCategoryColorMap } from "../lib/categoryColor";
import { prefersDarkTheme } from "../lib/colorScheme";
import {
  layoutGraph,
  parallelEdgeOffsets,
  type GraphLayoutKind,
} from "../lib/graphLayout";
import {
  affiliationTypeOptions,
  defaultAffiliationTypes,
  deriveGroups,
  type GroupMode,
} from "../lib/graphGroups";
import { suggestRelationshipTypes } from "../lib/relationshipTypeSuggestions";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { RelationshipFormWindow } from "./RelationshipFormWindow";
import type { RelationshipRow } from "./RelationshipFormWindow";
import {
  ClusterAnchorNode,
  EntityGraphNode,
  type ClusterAnchorNodeType,
  type EntityGraphNodeType,
} from "./EntityGraphNode";
import { GraphClusterLayer, type GraphCluster } from "./GraphClusterLayer";
import { RelationshipEdge } from "./RelationshipEdge";
import styles from "./RelationshipGraphWindow.module.css";

// Must be referentially stable: ReactFlow warns (and re-creates every node)
// when the nodeTypes object identity changes between renders.
const NODE_TYPES = {
  entity: EntityGraphNode,
  clusterAnchor: ClusterAnchorNode,
};

const EDGE_TYPES = { relationship: RelationshipEdge };

type GraphNode = EntityGraphNodeType | ClusterAnchorNodeType;

// How far apart two relationships between the same pair of entities bow.
const PARALLEL_EDGE_GAP = 42;

const NODE_WIDTH = 156;
const MIN_AVATAR = 56;
const MAX_AVATAR = 84;

const LAYOUT_OPTIONS: Array<{ value: GraphLayoutKind; label: string }> = [
  { value: "force", label: "Force Directed" },
  { value: "circle", label: "Circle" },
  { value: "grid", label: "Grid" },
];

// Every option is derived from data the campaign already has — see
// lib/graphGroups.ts for why there's no Group model behind this.
const GROUP_OPTIONS: Array<{ value: GroupMode; label: string }> = [
  { value: "none", label: "No grouping" },
  { value: "faction", label: "Faction / Affiliation" },
  { value: "type", label: "Type" },
  { value: "category", label: "Category" },
  { value: "tag", label: "Tag" },
];

// Fixed enum order, so the filter list doesn't reshuffle as entities are
// added, renamed, or deleted.
const CATEGORY_ORDER = [
  "CHARACTER",
  "LOCATION",
  "ORGANIZATION",
  "ITEM",
  "OTHER",
];

// The layout works in centre-of-portrait coordinates; ReactFlow positions a
// node by its top-left corner. Converting here keeps the spacing the layout
// computed from being skewed by portraits of different sizes.
function toTopLeft(center: { x: number; y: number }, avatar: number) {
  return { x: center.x - NODE_WIDTH / 2, y: center.y - avatar / 2 };
}

// Node id for the hidden side of a concealed-endpoint relationship. Namespaced
// so it can never collide with a real entity id.
const CONCEALED_PREFIX = "concealed:";

// Layout bucket for anything no cluster claimed.
const UNGROUPED = "";

interface GraphLink {
  /** The relationship's own id — also the ReactFlow edge id. */
  id: string;
  source: string;
  target: string;
  type: string;
  /** True when one endpoint is a placeholder rather than a real entity. */
  concealed: boolean;
}

const OPPOSITE = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
} as const;

// Poor-man's floating edges: pick the rim each edge leaves from based on where
// the other node actually sits, so links don't loop around the portrait to
// reach a fixed handle.
function facingSide(dx: number, dy: number): keyof typeof OPPOSITE {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "bottom" : "top";
}

// Create/edit UI (KAN-123) on top of the KAN-42 view-only graph: Owner/
// Storyteller/Co-Storyteller get a "+ Add Relationship" button and can click
// an edge to edit or delete it, gated the same way MapsWindow gates map
// authoring — Players/Observers still get the read-only view KAN-42 shipped.
export function RelationshipGraphWindow() {
  const { id: campaignId } = useParams<{ id: string }>();
  const openEntityWindow = useOpenEntityWindow(campaignId ?? "");
  const { openAddEditWindow: openRelationshipWindow } = useAddEditWindow({
    idPrefix: "relationship-form",
    width: 380,
    height: 480,
  });

  const [layout, setLayout] = useState<GraphLayoutKind>("force");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  // Purely local decluttering — it hides a cluster from *this* browser and
  // means nothing about what anyone else may see. What a player is allowed to
  // see is settled server-side by Entity/Relationship visibility.
  const [hiddenGroupIds, setHiddenGroupIds] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [showInterGroup, setShowInterGroup] = useState(true);
  const [showIntraGroup, setShowIntraGroup] = useState(true);
  // Unticking a category drops its entities from the graph the same way an
  // unticked cluster does — folded into hiddenEntityIds below rather than
  // filtered separately, so links to a hidden entity disappear too.
  const [hiddenCategories, setHiddenCategories] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId ?? "" },
    pause: !campaignId,
  });
  const [
    { data: entitiesData, fetching: entitiesFetching, error: entitiesError },
    reexecuteEntities,
  ] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });
  const [
    {
      data: relationshipsData,
      fetching: relationshipsFetching,
      error: relationshipsError,
    },
    reexecuteRelationships,
  ] = useQuery({
    query: RelationshipsDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });

  function refetch() {
    reexecuteEntities({ requestPolicy: "network-only" });
    reexecuteRelationships({ requestPolicy: "network-only" });
  }

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";

  const entities = useMemo(() => entitiesData?.entities ?? [], [entitiesData]);
  const relationships = useMemo(
    () => relationshipsData?.relationships ?? [],
    [relationshipsData],
  );

  const entityColors = useMemo(
    () => buildCategoryColorMap(entities.map((entity) => entity.type)),
    [entities],
  );
  const relationshipColors = useMemo(
    () =>
      buildCategoryColorMap(
        relationships.map((relationship) => relationship.type),
      ),
    [relationships],
  );

  // A concealed endpoint (KAN-134) comes back null for a non-Storyteller
  // viewer. The relationship itself is still real and still meant to be seen —
  // EntityWindow's list renders it with an "Unknown" counterpart — so the
  // graph gives the hidden side a placeholder node instead of dropping the
  // edge, which used to leave the two views disagreeing about what exists.
  const links = useMemo(() => {
    const resolved: GraphLink[] = [];

    for (const relationship of relationships) {
      const { sourceEntityId, targetEntityId, concealedEndpoint } =
        relationship;

      if (sourceEntityId && targetEntityId) {
        resolved.push({
          id: relationship.id,
          source: sourceEntityId,
          target: targetEntityId,
          type: relationship.type,
          concealed: false,
        });
        continue;
      }

      // One placeholder per relationship, never a single shared "Unknown"
      // node: merging two concealed endpoints into one would assert they're
      // the same person, which is the very thing being kept secret.
      const placeholder = `${CONCEALED_PREFIX}${relationship.id}`;

      if (concealedEndpoint === "SOURCE" && !sourceEntityId && targetEntityId) {
        resolved.push({
          id: relationship.id,
          source: placeholder,
          target: targetEntityId,
          type: relationship.type,
          concealed: true,
        });
      } else if (
        concealedEndpoint === "TARGET" &&
        sourceEntityId &&
        !targetEntityId
      ) {
        resolved.push({
          id: relationship.id,
          source: sourceEntityId,
          target: placeholder,
          type: relationship.type,
          concealed: true,
        });
      }
      // Anything else — both sides null, or a null id with no concealment to
      // account for it — is a row pointing at an entity the viewer was never
      // shown at all, and stays dropped.
    }

    return resolved;
  }, [relationships]);

  // Which relationship types mean "belongs to this faction" is the
  // Storyteller's call, not a guess from the type string — LOCATED_AT joins a
  // character to an organization without making them part of it. Options come
  // from the campaign's own CHARACTER<->ORGANIZATION links, so a custom
  // vocabulary appears here on its own.
  const affiliationOptions = useMemo(
    () => affiliationTypeOptions(entities, links),
    [entities, links],
  );

  const [affiliationOverride, setAffiliationOverride] =
    useState<ReadonlySet<string> | null>(null);

  const affiliationTypes = useMemo(
    () =>
      affiliationOverride ??
      new Set(
        defaultAffiliationTypes(
          affiliationOptions,
          suggestRelationshipTypes("CHARACTER", "ORGANIZATION"),
        ),
      ),
    [affiliationOverride, affiliationOptions],
  );

  const { groups, groupOf, absorbedEntityIds } = useMemo(
    () => deriveGroups(groupMode, entities, links, affiliationTypes),
    [groupMode, entities, links, affiliationTypes],
  );

  const groupColors = useMemo(
    () => buildCategoryColorMap(groups.map((group) => group.id)),
    [groups],
  );

  // Unticking a cluster takes its members off the graph with it — the whole
  // point is to get a crowded faction out of the way, not to leave its nodes
  // floating loose outside the outline that explained them.
  const hiddenEntityIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of groups) {
      if (!hiddenGroupIds.has(group.id)) {
        continue;
      }
      for (const memberId of group.memberIds) {
        ids.add(memberId);
      }
      if (group.entityId) {
        ids.add(group.entityId);
      }
    }
    for (const entity of entities) {
      if (hiddenCategories.has(entity.category)) {
        ids.add(entity.id);
      }
    }
    return ids;
  }, [groups, hiddenGroupIds, entities, hiddenCategories]);

  // Which categories the campaign actually has, in fixed enum order, each
  // with a count — so the panel only lists filters that do something and
  // doesn't reshuffle as entities change.
  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entity of entities) {
      counts.set(entity.category, (counts.get(entity.category) ?? 0) + 1);
    }
    return CATEGORY_ORDER.filter((category) => counts.has(category)).map(
      (category) => ({ category, count: counts.get(category) ?? 0 }),
    );
  }, [entities]);

  // Absorbed organization -> the cluster that replaced it, so its own
  // relationships can re-route to that hull's anchor point.
  const anchorOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const group of groups) {
      if (group.entityId) {
        map.set(group.entityId, group.id);
      }
    }
    return map;
  }, [groups]);

  const visibleEntities = useMemo(
    () =>
      entities.filter(
        (entity) =>
          !absorbedEntityIds.has(entity.id) && !hiddenEntityIds.has(entity.id),
      ),
    [entities, absorbedEntityIds, hiddenEntityIds],
  );

  const visibleLinks = useMemo(() => {
    const groupFor = (id: string) => anchorOf.get(id) ?? groupOf.get(id);

    return links.flatMap((link) => {
      if (
        hiddenEntityIds.has(link.source) ||
        hiddenEntityIds.has(link.target)
      ) {
        return [];
      }

      const sourceGroup = groupFor(link.source);
      const targetGroup = groupFor(link.target);
      const source = anchorOf.get(link.source) ?? link.source;
      const target = anchorOf.get(link.target) ?? link.target;

      // A member's link to its own organization is precisely what the hull
      // already draws — keeping it would spray a spoke from every portrait to
      // the middle of its own cluster.
      if (source === targetGroup || target === sourceGroup) {
        return [];
      }

      if (sourceGroup && targetGroup) {
        const withinOneCluster = sourceGroup === targetGroup;
        if (withinOneCluster ? !showIntraGroup : !showInterGroup) {
          return [];
        }
      } else if ((sourceGroup || targetGroup) && !showInterGroup) {
        // One end grouped, the other loose: still a link that crosses a
        // cluster boundary, so it follows the inter-group toggle.
        return [];
      }

      return [{ ...link, source, target }];
    });
  }, [
    links,
    anchorOf,
    groupOf,
    hiddenEntityIds,
    showInterGroup,
    showIntraGroup,
  ]);

  const concealedNodeIds = useMemo(
    () =>
      visibleLinks
        .filter((link) => link.concealed)
        .map((link) =>
          link.source.startsWith(CONCEALED_PREFIX) ? link.source : link.target,
        ),
    [visibleLinks],
  );

  // How many relationships an entity has drives its portrait size, so the
  // people the campaign actually revolves around read as the hubs they are.
  const degrees = useMemo(() => {
    const counts = new Map<string, number>();
    for (const link of visibleLinks) {
      for (const id of [link.source, link.target]) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [visibleLinks]);

  const avatarSizes = useMemo(() => {
    const maxDegree = Math.max(...[...degrees.values(), 1]);
    return new Map(
      visibleEntities.map((entity) => {
        const ratio = (degrees.get(entity.id) ?? 0) / maxDegree;
        return [entity.id, MIN_AVATAR + (MAX_AVATAR - MIN_AVATAR) * ratio];
      }),
    );
  }, [visibleEntities, degrees]);

  const positions = useMemo(
    () =>
      layoutGraph(
        // Grouping decides the arrangement once it's on: members have to land
        // together or there's nothing coherent for a hull to enclose.
        groupMode === "none" ? layout : "type",
        [
          ...visibleEntities.map((entity) => ({
            id: entity.id,
            group: groupOf.get(entity.id) ?? UNGROUPED,
          })),
          // Laid out alongside the real nodes, so a placeholder is pulled to
          // rest beside the entity it's linked to rather than parked in a
          // corner away from the only thing that gives it meaning.
          ...concealedNodeIds.map((id) => ({ id, group: UNGROUPED })),
        ],
        visibleLinks,
      ),
    [
      layout,
      groupMode,
      groupOf,
      visibleEntities,
      concealedNodeIds,
      visibleLinks,
    ],
  );

  // Anchors sit at the centre of whatever their members settled on, so a
  // cluster-to-cluster edge leaves from the middle of the hull it belongs to.
  const anchorPositions = useMemo(() => {
    const centres = new Map<string, { x: number; y: number }>();
    for (const group of groups) {
      const points = group.memberIds
        .map((memberId) => positions.get(memberId))
        .filter((point) => point !== undefined);
      if (points.length === 0) {
        continue;
      }
      centres.set(group.id, {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      });
    }
    return centres;
  }, [groups, positions]);

  const clusters = useMemo<GraphCluster[]>(
    () =>
      groups
        .filter((group) => !hiddenGroupIds.has(group.id))
        .map((group) => ({
          id: group.id,
          label: group.label,
          color: groupColors.get(group.id) ?? "#8b3bff",
          memberCount: group.memberIds.length,
          points: group.memberIds
            .map((memberId) => positions.get(memberId))
            .filter((point) => point !== undefined),
        }))
        .filter((cluster) => cluster.points.length > 0),
    [groups, hiddenGroupIds, groupColors, positions],
  );

  // Hovering a node highlights it and its immediate neighbours and fades the
  // rest — without it a campaign-sized graph is an unreadable hairball no
  // matter how good the layout is.
  const neighbourIds = useMemo(() => {
    if (!hoveredId) {
      return null;
    }
    const ids = new Set<string>([hoveredId]);
    for (const link of visibleLinks) {
      if (link.source === hoveredId) {
        ids.add(link.target);
      }
      if (link.target === hoveredId) {
        ids.add(link.source);
      }
    }
    return ids;
  }, [hoveredId, visibleLinks]);

  const [nodes, setNodes, onNodesChange] = useNodesState<GraphNode>([]);
  const [edges, setEdges] = useEdgesState<Edge>([]);

  // Rebuilt only when the graph's shape changes. Hover state is folded in by
  // the effect below instead, so highlighting a node doesn't throw away
  // wherever the user has since dragged the others to.
  useEffect(() => {
    const entityNodes: EntityGraphNodeType[] = visibleEntities.map((entity) => {
      const size = avatarSizes.get(entity.id) ?? MIN_AVATAR;
      return {
        id: entity.id,
        type: "entity" as const,
        position: toTopLeft(positions.get(entity.id) ?? { x: 0, y: 0 }, size),
        data: {
          name: entity.name,
          type: entity.type,
          image: entity.image,
          // A user-set Entity.color always wins, same as on the map; the
          // per-type palette entry is the fallback for uncoloured entities.
          color: entity.color ?? entityColors.get(entity.type) ?? "#8b3bff",
          size,
          dimmed: false,
          focused: false,
        },
      };
    });

    // Wording matches EntityWindow's relationship list, which calls the same
    // hidden counterpart "Unknown" — the two views describe one secret.
    const concealedNodes: EntityGraphNodeType[] = concealedNodeIds.map(
      (id) => ({
        id,
        type: "entity" as const,
        position: toTopLeft(positions.get(id) ?? { x: 0, y: 0 }, MIN_AVATAR),
        data: {
          name: "Unknown",
          type: "Concealed",
          color: "var(--border-strong)",
          size: MIN_AVATAR,
          dimmed: false,
          focused: false,
          concealed: true,
        },
      }),
    );

    const anchorNodes: ClusterAnchorNodeType[] = [...anchorPositions].map(
      ([groupId, centre]) => ({
        id: groupId,
        type: "clusterAnchor" as const,
        position: centre,
        // Never draggable: the anchor isn't a thing, it's the middle of the
        // hull, and dragging it away from there would strand the edges.
        draggable: false,
        selectable: false,
        data: {},
      }),
    );

    setNodes([...entityNodes, ...concealedNodes, ...anchorNodes]);
  }, [
    visibleEntities,
    concealedNodeIds,
    anchorPositions,
    positions,
    avatarSizes,
    entityColors,
    setNodes,
  ]);

  useEffect(() => {
    setNodes((current) =>
      current.map((node): GraphNode => {
        // Cluster anchors are invisible points at the centre of a hull, with
        // no data of their own — there is nothing on them to dim or focus.
        if (node.type === "clusterAnchor") {
          return node;
        }
        const dimmed = neighbourIds ? !neighbourIds.has(node.id) : false;
        const focused = node.id === hoveredId;
        if (node.data.dimmed === dimmed && node.data.focused === focused) {
          return node;
        }
        return { ...node, data: { ...node.data, dimmed, focused } };
      }),
    );
  }, [neighbourIds, hoveredId, setNodes]);

  // Two entities can hold several relationships at once (Enemy *and* Resents).
  // Left alone every one of them routes along the identical curve, stacking the
  // edges and overprinting the labels into an unreadable smear. Each gets an
  // index within its pair here, which the edge turns into its own bow.
  const parallelOffsets = useMemo(
    () => parallelEdgeOffsets(visibleLinks, PARALLEL_EDGE_GAP),
    [visibleLinks],
  );

  useEffect(() => {
    setEdges(
      visibleLinks.map(({ id, source, target, type, concealed }) => {
        const from = positions.get(source) ??
          anchorPositions.get(source) ?? { x: 0, y: 0 };
        const to = positions.get(target) ??
          anchorPositions.get(target) ?? { x: 0, y: 0 };
        const side = facingSide(to.x - from.x, to.y - from.y);
        const color = relationshipColors.get(type) ?? "#8b3bff";
        const connected =
          !neighbourIds ||
          (neighbourIds.has(source) && neighbourIds.has(target));
        const active = Boolean(
          hoveredId && (source === hoveredId || target === hoveredId),
        );
        const relationship = relationships.find(
          (candidate) => candidate.id === id,
        );

        return {
          id,
          source,
          target,
          type: "relationship" as const,
          sourceHandle: `s-${side}`,
          targetHandle: `t-${OPPOSITE[side]}`,
          data: {
            label: type,
            color,
            offset: parallelOffsets.get(id) ?? 0,
            concealed,
            connected,
            active,
            onSelect:
              isWriter && relationship
                ? () => openEditRelationshipWindow(relationship)
                : undefined,
          },
          style: {
            stroke: color,
            strokeWidth: active ? 2.4 : 1.4,
            opacity: connected ? (active ? 1 : 0.65) : 0.12,
            // Dashed so the link to a placeholder reads as unresolved at a
            // glance, without having to hover it to see the "Unknown" node.
            strokeDasharray: concealed ? "6 5" : undefined,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 16,
            height: 16,
          },
        } satisfies Edge;
      }),
    );
    // openEditRelationshipWindow is redefined every render; the edges only
    // need rebuilding when the graph or its highlighting actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    visibleLinks,
    positions,
    anchorPositions,
    parallelOffsets,
    relationships,
    relationshipColors,
    neighbourIds,
    hoveredId,
    isWriter,
    setEdges,
  ]);

  function openCreateRelationshipWindow() {
    if (!campaignId) {
      return;
    }
    openRelationshipWindow<RelationshipRow>(
      { mode: "create" },
      "New Relationship",
      (close) => (
        <RelationshipFormWindow
          campaignId={campaignId}
          mode={{ mode: "create" }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  function openEditRelationshipWindow(relationship: RelationshipRow) {
    if (!campaignId) {
      return;
    }
    openRelationshipWindow<RelationshipRow>(
      { mode: "edit", item: relationship },
      `Edit: ${relationship.type}`,
      (close) => (
        <RelationshipFormWindow
          campaignId={campaignId}
          mode={{ mode: "edit", item: relationship }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  useWindowChromeSync(entitiesFetching || relationshipsFetching, refetch);

  if (entitiesFetching || relationshipsFetching) {
    return <p>Loading relationship graph…</p>;
  }

  const error = entitiesError ?? relationshipsError;
  if (error) {
    return (
      <p>
        {formatGraphQLError(error) ?? "Unable to load the relationship graph."}
      </p>
    );
  }

  if (entities.length === 0) {
    return <p>No entities yet — add some NPCs to see the graph.</p>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.canvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          colorMode={prefersDarkTheme() ? "dark" : "light"}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          minZoom={0.15}
          maxZoom={2.5}
          nodesConnectable={false}
          elementsSelectable={false}
          onNodeMouseEnter={(_event, node) => setHoveredId(node.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onPaneClick={() => setHoveredId(null)}
          onNodeClick={(_event, node) => {
            const entity = entities.find(
              (candidate) => candidate.id === node.id,
            );
            if (entity) {
              openEntityWindow(entity);
            }
          }}
          onEdgeClick={(_event, edge) => {
            if (!isWriter) {
              return;
            }
            const relationship = relationships.find(
              (candidate) => candidate.id === edge.id,
            );
            if (relationship) {
              openEditRelationshipWindow(relationship);
            }
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
          <Controls showInteractive={false} position="bottom-right" />
          <GraphClusterLayer clusters={clusters} />
        </ReactFlow>

        {categoryOptions.length > 1 ? (
          <div className={styles.filterPanel}>
            <p className={styles.panelHeading}>Entity Types</p>
            <ul className={styles.clusterList}>
              {categoryOptions.map(({ category, count }) => (
                <li key={category}>
                  <label className={styles.clusterRow}>
                    <input
                      type="checkbox"
                      checked={!hiddenCategories.has(category)}
                      onChange={() =>
                        setHiddenCategories((current) => {
                          const next = new Set(current);
                          if (!next.delete(category)) {
                            next.add(category);
                          }
                          return next;
                        })
                      }
                    />
                    <span className={styles.clusterName}>{category}</span>
                    <span className={styles.clusterCount}>{count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className={styles.toolbar}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Layout</span>
            <Select
              className={styles.select}
              // Grouping owns the arrangement while it's on, so offering a
              // layout that would scatter the clusters would just lie.
              disabled={groupMode !== "none"}
              value={layout}
              onChange={(event) =>
                setLayout(event.target.value as GraphLayoutKind)
              }
            >
              {LAYOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Group by</span>
            <Select
              className={styles.select}
              value={groupMode}
              onChange={(event) => {
                setGroupMode(event.target.value as GroupMode);
                // Cluster ids don't survive a mode change, so a stale hidden
                // id would silently hide something in the new grouping.
                setHiddenGroupIds(new Set());
              }}
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
          {isWriter ? (
            <Button type="button" onClick={openCreateRelationshipWindow}>
              <Icon icon={Plus} size={15} aria-hidden="true" />
              Add Relationship
            </Button>
          ) : null}
        </div>

        {/* Shown while faction grouping is on even with nothing clustered yet,
            so the affiliation picker below stays reachable — otherwise a
            campaign whose vocabulary produced no clusters would have no way
            back. */}
        {groups.length > 0 ||
        (groupMode === "faction" && affiliationOptions.length > 0) ? (
          <div className={styles.clusterPanel}>
            <p className={styles.panelHeading}>Clusters</p>
            {groups.length === 0 ? (
              <p className={styles.panelNote}>
                No clusters — pick the relationship types that mean affiliation.
              </p>
            ) : null}
            <ul className={styles.clusterList}>
              {groups.map((group) => (
                <li key={group.id}>
                  <label className={styles.clusterRow}>
                    <input
                      type="checkbox"
                      checked={!hiddenGroupIds.has(group.id)}
                      onChange={() =>
                        setHiddenGroupIds((current) => {
                          const next = new Set(current);
                          if (!next.delete(group.id)) {
                            next.add(group.id);
                          }
                          return next;
                        })
                      }
                    />
                    <span
                      className={styles.swatch}
                      style={{ background: groupColors.get(group.id) }}
                      aria-hidden="true"
                    />
                    <span className={styles.clusterName}>{group.label}</span>
                    <span className={styles.clusterCount}>
                      {group.memberIds.length}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {groupMode === "faction" && affiliationOptions.length > 0 ? (
              <>
                <p className={styles.panelHeading}>Affiliation via</p>
                {affiliationOptions.map((option) => (
                  <label key={option} className={styles.toggleRow}>
                    <input
                      type="checkbox"
                      checked={affiliationTypes.has(option)}
                      onChange={() =>
                        setAffiliationOverride((current) => {
                          const next = new Set(current ?? affiliationTypes);
                          if (!next.delete(option)) {
                            next.add(option);
                          }
                          return next;
                        })
                      }
                    />
                    {option}
                  </label>
                ))}
              </>
            ) : null}

            <p className={styles.panelHeading}>Show</p>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={showInterGroup}
                onChange={() => setShowInterGroup((current) => !current)}
              />
              Inter-group relationships
            </label>
            <label className={styles.toggleRow}>
              <input
                type="checkbox"
                checked={showIntraGroup}
                onChange={() => setShowIntraGroup((current) => !current)}
              />
              Intra-group relationships
            </label>
            <p className={styles.panelNote}>
              Hides clusters in your view only — it doesn&apos;t change what
              anyone else can see.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
