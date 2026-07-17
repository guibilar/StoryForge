import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "urql";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Modal,
  Textarea,
} from "@storyforge/ui";

import {
  ArchiveCampaignDocument,
  UpdateCampaignDocument,
} from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./ManageCampaignModal.module.css";

export interface ManageCampaignModalProps {
  open: boolean;
  campaign: { id: string; name: string; description?: string | null };
  onClose: () => void;
  onUpdated: () => void;
  onArchived: () => void;
}

export function ManageCampaignModal({
  open,
  campaign,
  onClose,
  onUpdated,
  onArchived,
}: ManageCampaignModalProps) {
  const [{ error, fetching }, updateCampaign] = useMutation(
    UpdateCampaignDocument,
  );
  const [{ error: archiveError, fetching: archiving }, archiveCampaign] =
    useMutation(ArchiveCampaignDocument);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      formRef.current?.reset();
    }
  }, [open, campaign]);

  function handleClose() {
    setConfirmingArchive(false);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();

    const result = await updateCampaign({
      input: {
        id: campaign.id,
        name,
        description: description || null,
      },
    });

    if (!openRef.current) {
      return;
    }

    if (result.data?.updateCampaign) {
      onUpdated();
    }
  }

  async function handleArchive() {
    const result = await archiveCampaign({ id: campaign.id });

    if (!openRef.current) {
      return;
    }

    if (result.data?.archiveCampaign) {
      setConfirmingArchive(false);
      onArchived();
    }
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <h2>Manage campaign</h2>
      <Form ref={formRef} onSubmit={handleSubmit}>
        <FormError>{formatGraphQLError(error)}</FormError>
        <FormField label="Name" htmlFor="manage-campaign-name">
          <Input
            id="manage-campaign-name"
            name="name"
            defaultValue={campaign.name}
            required
          />
        </FormField>
        <FormField label="Description" htmlFor="manage-campaign-description">
          <Textarea
            id="manage-campaign-description"
            name="description"
            defaultValue={campaign.description ?? ""}
            rows={4}
          />
        </FormField>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={fetching}>
            Save
          </Button>
        </div>
      </Form>

      <div className={styles.archiveSection}>
        {confirmingArchive ? (
          <>
            <FormError>{formatGraphQLError(archiveError)}</FormError>
            <p className={styles.confirmText}>
              Archive &quot;{campaign.name}&quot;? It will disappear from the
              dashboard and can&apos;t be reopened.
            </p>
            <div className={styles.actions}>
              <Button
                type="button"
                variant="text"
                onClick={() => setConfirmingArchive(false)}
              >
                Never mind
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleArchive}
                disabled={archiving}
              >
                Confirm archive
              </Button>
            </div>
          </>
        ) : (
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmingArchive(true)}
          >
            Archive campaign
          </Button>
        )}
      </div>
    </Modal>
  );
}
