import type { FormEvent } from "react";
import { useEffect, useRef } from "react";
import { useMutation } from "urql";
import {
  Button,
  Form,
  FormError,
  FormField,
  Input,
  Modal,
} from "@storyforge/ui";

import { CreateCampaignDocument } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";

export interface CreateCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateCampaignDialog({
  open,
  onClose,
  onCreated,
}: CreateCampaignDialogProps) {
  const [{ error, fetching }, createCampaign] = useMutation(
    CreateCampaignDocument,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
    if (open) {
      formRef.current?.reset();
    }
  }, [open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const description = String(data.get("description") ?? "").trim();

    const result = await createCampaign({
      input: {
        name,
        description: description || null,
      },
    });

    if (!openRef.current) {
      return;
    }

    if (result.data?.createCampaign) {
      form.reset();
      onCreated();
    }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h2>New campaign</h2>
      <Form ref={formRef} onSubmit={handleSubmit}>
        <FormError>{formatGraphQLError(error)}</FormError>
        <FormField label="Name" htmlFor="campaign-name">
          <Input id="campaign-name" name="name" required />
        </FormField>
        <FormField label="Description" htmlFor="campaign-description">
          <Input id="campaign-description" name="description" />
        </FormField>
        <Button type="submit" disabled={fetching}>
          Create
        </Button>
      </Form>
    </Modal>
  );
}
