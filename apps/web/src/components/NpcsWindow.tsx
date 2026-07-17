import type { FormEvent } from "react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Modal,
} from "@storyforge/ui";

import {
  CampaignDocument,
  CreateEntityDocument,
  DeleteEntityDocument,
  EntitiesDocument,
  MeDocument,
  UpdateEntityDocument,
} from "../gql/graphql";
import type { EntityVisibility } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./NpcsWindow.module.css";

const NPC_TYPE = "NPC";
const VISIBILITIES: EntityVisibility[] = ["PUBLIC", "STORYTELLER", "PRIVATE"];

interface NpcRow {
  id: string;
  name: string;
  description?: string | null;
  visibility: EntityVisibility;
  tags: { id: string; name: string }[];
}

type ModalState = { mode: "create" } | { mode: "edit"; npc: NpcRow } | null;

export function NpcsWindow() {
  const { id: campaignId } = useParams<{ id: string }>();

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId ?? "" },
    pause: !campaignId,
  });
  const [{ data: entitiesData, fetching, error }, reexecuteEntities] = useQuery(
    {
      query: EntitiesDocument,
      variables: { campaignId: campaignId ?? "", filter: { type: NPC_TYPE } },
      pause: !campaignId,
    },
  );

  const [createState, createEntity] = useMutation(CreateEntityDocument);
  const [updateState, updateEntity] = useMutation(UpdateEntityDocument);
  const [, deleteEntity] = useMutation(DeleteEntityDocument);

  const [modal, setModal] = useState<ModalState>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";
  const npcs: NpcRow[] = entitiesData?.entities ?? [];

  function refetch() {
    reexecuteEntities({ requestPolicy: "network-only" });
  }

  function closeModal() {
    setModal(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId || !modal) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const visibility = String(
      data.get("visibility") ?? "PUBLIC",
    ) as EntityVisibility;

    if (modal.mode === "create") {
      const result = await createEntity({
        input: {
          campaignId,
          type: NPC_TYPE,
          name,
          description: description || null,
          visibility,
        },
      });
      if (result.data?.createEntity) {
        closeModal();
        refetch();
      }
    } else {
      const result = await updateEntity({
        input: {
          id: modal.npc.id,
          name,
          description: description || null,
          visibility,
        },
      });
      if (result.data?.updateEntity) {
        closeModal();
        refetch();
      }
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteEntity({ id });
    if (result.data?.deleteEntity) {
      setConfirmingDeleteId(null);
      refetch();
    }
  }

  if (fetching) {
    return <p>Loading NPCs…</p>;
  }

  if (error) {
    return <p>{formatGraphQLError(error) ?? "Unable to load NPCs."}</p>;
  }

  const formError = formatGraphQLError(
    modal?.mode === "create" ? createState.error : updateState.error,
  );

  return (
    <div className={styles.wrap}>
      <ul className={styles.list}>
        {npcs.map((npc) => (
          <li key={npc.id} className={styles.row}>
            <div className={styles.info}>
              <span className={styles.name}>{npc.name}</span>
              <div className={styles.chips}>
                <span className={styles.chip}>{npc.visibility}</span>
                {npc.tags.map((tag) => (
                  <span key={tag.id} className={styles.chip}>
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
            {isWriter ? (
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModal({ mode: "edit", npc })}
                >
                  Edit
                </Button>
                {confirmingDeleteId === npc.id ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleDelete(npc.id)}
                    >
                      Confirm
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setConfirmingDeleteId(null)}
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setConfirmingDeleteId(npc.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {isWriter ? (
        <Button type="button" onClick={() => setModal({ mode: "create" })}>
          + New NPC
        </Button>
      ) : null}

      <Modal open={modal !== null} onClose={closeModal}>
        {modal ? (
          <>
            <h2>{modal.mode === "edit" ? "Edit NPC" : "New NPC"}</h2>
            <Form onSubmit={handleSubmit}>
              <FormError>{formError}</FormError>
              <FormField label="Name" htmlFor="npc-name">
                <Input
                  id="npc-name"
                  name="name"
                  defaultValue={modal.mode === "edit" ? modal.npc.name : ""}
                  required
                />
              </FormField>
              <FormField label="Description" htmlFor="npc-description">
                <textarea
                  id="npc-description"
                  name="description"
                  defaultValue={
                    modal.mode === "edit" ? (modal.npc.description ?? "") : ""
                  }
                  rows={4}
                  className={styles.textarea}
                />
              </FormField>
              <FormField label="Visibility" htmlFor="npc-visibility">
                <select
                  id="npc-visibility"
                  name="visibility"
                  defaultValue={
                    modal.mode === "edit" ? modal.npc.visibility : "PUBLIC"
                  }
                  className={styles.visibilitySelect}
                >
                  {VISIBILITIES.map((visibility) => (
                    <option key={visibility} value={visibility}>
                      {visibility}
                    </option>
                  ))}
                </select>
              </FormField>
              <div className={styles.modalActions}>
                <Button type="button" variant="secondary" onClick={closeModal}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createState.fetching || updateState.fetching}
                >
                  Save
                </Button>
              </div>
            </Form>
          </>
        ) : null}
      </Modal>
    </div>
  );
}
