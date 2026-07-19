import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, FormError, Icon, Input, Select } from "@storyforge/ui";

import {
  CampaignDocument,
  DeleteEventDocument,
  EntitiesDocument,
  EventsDocument,
  MeDocument,
} from "../gql/graphql";
import { useAddEditWindow } from "../hooks/useAddEditWindow";
import { EventFormWindow } from "./EventFormWindow";
import type { EventRow } from "./EventFormWindow";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import styles from "./TimelineWindow.module.css";

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

  const [deleteState, deleteEvent] = useMutation(DeleteEventDocument);
  const { openAddEditWindow } = useAddEditWindow({
    idPrefix: "event-form",
    width: 440,
    height: 560,
  });

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null,
  );
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

  function openCreateWindow() {
    if (!campaignId) {
      return;
    }
    openAddEditWindow<EventRow>({ mode: "create" }, "New Event", (close) => (
      <EventFormWindow
        campaignId={campaignId}
        mode={{ mode: "create" }}
        onSaved={refetch}
        onClose={close}
      />
    ));
  }

  function openEditWindow(event: EventRow) {
    if (!campaignId) {
      return;
    }
    openAddEditWindow<EventRow>(
      { mode: "edit", item: event },
      `Edit: ${event.title}`,
      (close) => (
        <EventFormWindow
          campaignId={campaignId}
          mode={{ mode: "edit", item: event }}
          onSaved={refetch}
          onClose={close}
        />
      ),
    );
  }

  async function handleDelete(id: string) {
    const result = await deleteEvent({ id });
    if (result.data?.deleteEvent) {
      setConfirmingDeleteId(null);
      refetch();
    }
  }

  useWindowChromeSync(fetching, refetch);

  if (fetching) {
    return <p>Loading timeline…</p>;
  }

  if (error) {
    return <p>{formatGraphQLError(error) ?? "Unable to load timeline."}</p>;
  }

  const deleteError = formatGraphQLError(deleteState.error);

  return (
    <div className={styles.wrap}>
      <div className={styles.filters}>
        <Input
          type="search"
          className={styles.searchInput}
          placeholder="Search title or description…"
          aria-label="Search events"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        <Select
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
        </Select>
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
                  onClick={() => openEditWindow(event)}
                >
                  <Icon icon={Pencil} size={15} aria-hidden="true" />
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
                    <Icon icon={Trash2} size={15} aria-hidden="true" />
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
        <Button type="button" onClick={openCreateWindow}>
          <Icon icon={Plus} size={15} aria-hidden="true" />
          New event
        </Button>
      ) : null}
    </div>
  );
}
