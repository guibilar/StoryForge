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

import { EntitiesDocument, RelationshipsDocument } from "../gql/graphql";
import { useOpenEntityWindow } from "../hooks/useOpenEntityWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { buildCategoryColorMap } from "../lib/categoryColor";
import styles from "./RelationshipGraphWindow.module.css";

const RADIUS = 220;

function circlePosition(index: number, total: number) {
  const angle = (2 * Math.PI * index) / Math.max(total, 1);
  return {
    x: RADIUS + RADIUS * Math.cos(angle),
    y: RADIUS + RADIUS * Math.sin(angle),
  };
}

export function RelationshipGraphWindow() {
  const { id: campaignId } = useParams<{ id: string }>();
  const openEntityWindow = useOpenEntityWindow(campaignId ?? "");

  const [
    { data: entitiesData, fetching: entitiesFetching, error: entitiesError },
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
  ] = useQuery({
    query: RelationshipsDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });

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
      relationships.map((relationship) => {
        const color = relationshipColors.get(relationship.type);
        return {
          id: relationship.id,
          source: relationship.sourceEntityId,
          target: relationship.targetEntityId,
          label: relationship.type,
          style: { stroke: color },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      }),
    [relationships, relationshipColors],
  );

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
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={(_event, node) => {
          const entity = entities.find((candidate) => candidate.id === node.id);
          if (entity) {
            openEntityWindow(entity);
          }
        }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
