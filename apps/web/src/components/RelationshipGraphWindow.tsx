import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "urql";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus } from "lucide-react";
import { Button, Icon } from "@storyforge/ui";

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
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import { RelationshipFormWindow } from "./RelationshipFormWindow";
import type { RelationshipRow } from "./RelationshipFormWindow";
import styles from "./RelationshipGraphWindow.module.css";

const RADIUS = 220;

function circlePosition(index: number, total: number) {
  const angle = (2 * Math.PI * index) / Math.max(total, 1);
  return {
    x: RADIUS + RADIUS * Math.cos(angle),
    y: RADIUS + RADIUS * Math.sin(angle),
  };
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

  const nodes: Node[] = useMemo(
    () =>
      entities.map((entity, index) => ({
        id: entity.id,
        position: circlePosition(index, entities.length),
        data: { label: `${entity.name} (${entity.type})` },
        style: {
          background: entityColors.get(entity.type),
          color: "#fff",
          border: "1px solid rgba(0, 0, 0, 0.2)",
          borderRadius: 8,
          padding: "6px 10px",
          fontSize: 12,
          width: "auto",
        },
      })),
    [entities, entityColors],
  );

  const edges: Edge[] = useMemo(
    () =>
      relationships
        // A concealed endpoint (KAN-134) comes back null for a non-Storyteller
        // viewer — there's no node for ReactFlow to draw that edge to, so the
        // link just doesn't appear here yet. EntityWindow's relationship list
        // is where it still shows up, as an "Unknown" counterpart.
        .filter(
          (relationship) =>
            relationship.sourceEntityId && relationship.targetEntityId,
        )
        .map((relationship) => {
          const color = relationshipColors.get(relationship.type);
          return {
            id: relationship.id,
            source: relationship.sourceEntityId as string,
            target: relationship.targetEntityId as string,
            label: relationship.type,
            style: { stroke: color },
            markerEnd: { type: MarkerType.ArrowClosed, color },
          };
        }),
    [relationships, relationshipColors],
  );

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
      {isWriter ? (
        <div className={styles.actions}>
          <Button type="button" onClick={openCreateRelationshipWindow}>
            <Icon icon={Plus} size={15} aria-hidden="true" />
            Add Relationship
          </Button>
        </div>
      ) : null}
      <div className={styles.canvas}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
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
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
