import type { FormEvent } from "react";
import { useMemo, useState } from "react";
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
  AttachParticipantDocument,
  CampaignDocument,
  CreateEventDocument,
  DeleteEventDocument,
  DetachParticipantDocument,
  EntitiesDocument,
  EventsDocument,
  MeDocument,
  SessionsDocument,
  UpdateEventDocument,
} from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./TimelineWindow.module.css";

interface Participant {
  id: string;
  name: string;
}

interface EventRow {
  id: string;
  title: string;
  description?: string | null;
  occurredAt: string;
  sessionId?: string | null;
  session?: { id: string; sessionNumber: number } | null;
  participants: Participant[];
}

type ModalState = { mode: "create" } | { mode: "edit"; event: EventRow } | null;

export function TimelineWindow() {
  const { id: campaignId } = useParams<{ id: string }>();

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData }] = useQuery({
    query: CampaignDocument,
    variables: { id: campaignId ?? "" },
    pause: !campaignId,
  });
  const [{ data: eventsData, fetching, error }, reexecuteEvents] = useQuery({
    query: EventsDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });
  const [{ data: entitiesData }] = useQuery({
    query: EntitiesDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });
  const [{ data: sessionsData }] = useQuery({
    query: SessionsDocument,
    variables: { campaignId: campaignId ?? "" },
    pause: !campaignId,
  });

  const [createState, createEvent] = useMutation(CreateEventDocument);
  const [updateState, updateEvent] = useMutation(UpdateEventDocument);
  const [deleteState, deleteEvent] = useMutation(DeleteEventDocument);
  const [, attachParticipant] = useMutation(AttachParticipantDocument);
  const [, detachParticipant] = useMutation(DetachParticipantDocument);

  const [modal, setModal] = useState<ModalState>(null);
  const [dismissedFormError, setDismissedFormError] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<
    string[]
  >([]);
  const [searchText, setSearchText] = useState("");
  const [filterParticipantId, setFilterParticipantId] = useState("");

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isWriter =
    myRole === "OWNER" ||
    myRole === "STORYTELLER" ||
    myRole === "CO_STORYTELLER";
  const entities = entitiesData?.entities ?? [];
  const sessions = sessionsData?.sessions ?? [];

  const events: EventRow[] = useMemo(
    () =>
      [...(eventsData?.events ?? [])].sort((a, b) =>
        a.occurredAt.localeCompare(b.occurredAt),
      ),
    [eventsData],
  );

  const visibleEvents = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    return events.filter((event) => {
      const matchesSearch =
        !needle ||
        event.title.toLowerCase().includes(needle) ||
        (event.description ?? "").toLowerCase().includes(needle);
      const matchesParticipant =
        !filterParticipantId ||
        event.participants.some((p) => p.id === filterParticipantId);
      return matchesSearch && matchesParticipant;
    });
  }, [events, searchText, filterParticipantId]);

  function refetch() {
    reexecuteEvents({ requestPolicy: "network-only" });
  }

  function openCreateModal() {
    setDismissedFormError(false);
    setSelectedParticipantIds([]);
    setModal({ mode: "create" });
  }

  function openEditModal(event: EventRow) {
    setDismissedFormError(false);
    setSelectedParticipantIds(event.participants.map((p) => p.id));
    setModal({ mode: "edit", event });
  }

  function closeModal() {
    setModal(null);
    setDismissedFormError(true);
  }

  function toggleParticipant(entityId: string) {
    setSelectedParticipantIds((current) =>
      current.includes(entityId)
        ? current.filter((id) => id !== entityId)
        : [...current, entityId],
    );
  }

  async function syncParticipants(eventId: string, previousIds: string[]) {
    const added = selectedParticipantIds.filter(
      (id) => !previousIds.includes(id),
    );
    const removed = previousIds.filter(
      (id) => !selectedParticipantIds.includes(id),
    );

    await Promise.all([
      ...added.map((entityId) => attachParticipant({ eventId, entityId })),
      ...removed.map((entityId) => detachParticipant({ eventId, entityId })),
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId || !modal) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();
    const occurredAt = String(data.get("occurredAt") ?? "").trim();
    const sessionId = String(data.get("sessionId") ?? "") || null;

    if (!title || !occurredAt) {
      return;
    }

    if (modal.mode === "create") {
      const result = await createEvent({
        input: {
          campaignId,
          title,
          description: description || null,
          occurredAt,
          sessionId,
        },
      });
      if (result.data?.createEvent) {
        await syncParticipants(result.data.createEvent.id, []);
        closeModal();
        refetch();
      }
    } else {
      const result = await updateEvent({
        input: {
          id: modal.event.id,
          title,
          description: description || null,
          occurredAt,
          sessionId,
        },
      });
      if (result.data?.updateEvent) {
        await syncParticipants(
          modal.event.id,
          modal.event.participants.map((p) => p.id),
        );
        closeModal();
        refetch();
      }
    }
  }

  async function handleDelete(id: string) {
    const result = await deleteEvent({ id });
    if (result.data?.deleteEvent) {
      setConfirmingDeleteId(null);
      refetch();
    }
  }

  if (fetching) {
    return <p>Loading timeline…</p>;
  }

  if (error) {
    return <p>{formatGraphQLError(error) ?? "Unable to load timeline."}</p>;
  }

  const deleteError = formatGraphQLError(deleteState.error);
  const formError = dismissedFormError
    ? null
    : formatGraphQLError(
        modal?.mode === "create" ? createState.error : updateState.error,
      );

  return (
    <div className={styles.wrap}>
      <div className={styles.filters}>
        <input
          type="search"
          className={styles.searchInput}
          placeholder="Search title or description…"
          aria-label="Search events"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <select
          className={styles.participantSelect}
          aria-label="Filter by participant"
          value={filterParticipantId}
          onChange={(e) => setFilterParticipantId(e.target.value)}
        >
          <option value="">All participants</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
            </option>
          ))}
        </select>
      </div>

      <ol className={styles.timeline}>
        {visibleEvents.map((event) => (
          <li key={event.id} className={styles.item}>
            <div className={styles.body}>
              <span className={styles.title}>{event.title}</span>
              <div className={styles.tags}>
                {event.participants.map((p) => (
                  <span key={p.id} className={styles.chip}>
                    {p.name}
                  </span>
                ))}
                {event.session ? (
                  <span
                    className={styles.chip}
                    title={`Logged in Session #${event.session.sessionNumber}`}
                  >
                    {`#${event.session.sessionNumber}`}
                  </span>
                ) : null}
              </div>
            </div>
            {isWriter ? (
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => openEditModal(event)}
                >
                  Edit
                </Button>
                {confirmingDeleteId === event.id ? (
                  <>
                    <FormError>{deleteError}</FormError>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={deleteState.fetching}
                      onClick={() => handleDelete(event.id)}
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
                    onClick={() => setConfirmingDeleteId(event.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
        {visibleEvents.length === 0 ? (
          <li className={styles.empty}>No events yet.</li>
        ) : null}
      </ol>

      {isWriter ? (
        <Button type="button" onClick={openCreateModal}>
          + New event
        </Button>
      ) : null}

      <Modal open={modal !== null} onClose={closeModal}>
        {modal ? (
          <>
            <h2>{modal.mode === "edit" ? "Edit event" : "New event"}</h2>
            <Form onSubmit={handleSubmit}>
              <FormError>{formError}</FormError>
              <FormField label="Title" htmlFor="event-title">
                <Input
                  id="event-title"
                  name="title"
                  defaultValue={modal.mode === "edit" ? modal.event.title : ""}
                  required
                />
              </FormField>
              <FormField label="Description" htmlFor="event-description">
                <textarea
                  id="event-description"
                  name="description"
                  defaultValue={
                    modal.mode === "edit" ? (modal.event.description ?? "") : ""
                  }
                  rows={3}
                  className={styles.textarea}
                />
              </FormField>
              <FormField label="Order (in-fiction)" htmlFor="event-occurredAt">
                <Input
                  id="event-occurredAt"
                  name="occurredAt"
                  placeholder="e.g. Day 14, after the masquerade"
                  defaultValue={
                    modal.mode === "edit" ? modal.event.occurredAt : ""
                  }
                  required
                />
              </FormField>
              <FormField label="Logged in session" htmlFor="event-sessionId">
                <select
                  id="event-sessionId"
                  name="sessionId"
                  defaultValue={
                    modal.mode === "edit" ? (modal.event.sessionId ?? "") : ""
                  }
                  className={styles.sessionSelect}
                >
                  <option value="">— none —</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      #{session.sessionNumber} — {session.date}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Participants" htmlFor="event-participants">
                <div
                  className={styles.participantChecks}
                  id="event-participants"
                >
                  {entities.map((entity) => (
                    <label key={entity.id} className={styles.checkPill}>
                      <input
                        type="checkbox"
                        checked={selectedParticipantIds.includes(entity.id)}
                        onChange={() => toggleParticipant(entity.id)}
                      />
                      {entity.name}
                    </label>
                  ))}
                </div>
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
