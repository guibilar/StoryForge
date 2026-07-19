import { useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { UserMinus, UserPlus } from "lucide-react";
import {
  Button,
  Form,
  FormError,
  FormField,
  Icon,
  IconButton,
  Input,
  Select,
} from "@storyforge/ui";

import {
  AddCampaignMemberDocument,
  CampaignDocument,
  MeDocument,
  RemoveCampaignMemberDocument,
  UpdateCampaignMemberRoleDocument,
} from "../gql/graphql";
import type { CampaignRole } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import { useWindowChromeSync } from "../lib/WindowChromeContext";
import styles from "./MembersWindow.module.css";

const ROLES: CampaignRole[] = [
  "OWNER",
  "STORYTELLER",
  "CO_STORYTELLER",
  "PLAYER",
  "OBSERVER",
];

// The raw enum ("CO_STORYTELLER") was shouting in every row and every
// option; the wire value is unchanged, only what's rendered.
const ROLE_LABELS: Record<CampaignRole, string> = {
  OWNER: "Owner",
  STORYTELLER: "Storyteller",
  CO_STORYTELLER: "Co-Storyteller",
  PLAYER: "Player",
  OBSERVER: "Observer",
};

export function MembersWindow() {
  const { id: campaignId } = useParams<{ id: string }>();

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData, fetching, error }, reexecuteCampaign] = useQuery(
    {
      query: CampaignDocument,
      variables: { id: campaignId ?? "" },
      pause: !campaignId,
    },
  );

  const [addState, addMember] = useMutation(AddCampaignMemberDocument);
  const [removeState, removeMember] = useMutation(RemoveCampaignMemberDocument);
  const [updateRoleState, updateRole] = useMutation(
    UpdateCampaignMemberRoleDocument,
  );

  const currentUserId = meData?.me?.id;
  const members = campaignData?.campaign?.members ?? [];
  const myRole = members.find(
    (member) => member.userId === currentUserId,
  )?.role;
  const isOwner = myRole === "OWNER";
  // The add-member form is a three-field block that most visits don't need,
  // so it stays behind a disclosure and the roster leads.
  const [addFormOpen, setAddFormOpen] = useState(false);

  function refetch() {
    reexecuteCampaign({ requestPolicy: "network-only" });
  }

  async function handleRoleChange(userId: string, role: CampaignRole) {
    if (!campaignId) {
      return;
    }
    await updateRole({ input: { campaignId, userId, role } });
    refetch();
  }

  async function handleRemove(userId: string) {
    if (!campaignId || userId === currentUserId) {
      return;
    }
    await removeMember({ campaignId, userId });
    refetch();
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const role = String(data.get("role") ?? "PLAYER") as CampaignRole;

    const result = await addMember({ input: { campaignId, email, role } });
    if (result.data?.addCampaignMember) {
      form.reset();
      setAddFormOpen(false);
      refetch();
    }
  }

  useWindowChromeSync(fetching, refetch);

  if (fetching) {
    return <p>Loading members…</p>;
  }

  if (error || !campaignData?.campaign) {
    return <p>{formatGraphQLError(error) ?? "Unable to load members."}</p>;
  }

  const manageError =
    formatGraphQLError(updateRoleState.error) ??
    formatGraphQLError(removeState.error);

  return (
    <div className={styles.wrap}>
      <FormError>{manageError}</FormError>
      <ul className={styles.list}>
        {members.map((member) => (
          <li key={member.userId} className={styles.row}>
            <span className={styles.email}>{member.user.email}</span>
            {isOwner ? (
              <Select
                aria-label={`Role for ${member.user.email}`}
                value={member.role}
                disabled={updateRoleState.fetching}
                onChange={(event) =>
                  handleRoleChange(
                    member.userId,
                    event.target.value as CampaignRole,
                  )
                }
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            ) : (
              <span className={styles.role}>{ROLE_LABELS[member.role]}</span>
            )}
            {isOwner && member.userId !== currentUserId ? (
              <div className={styles.actions}>
                <IconButton
                  icon={UserMinus}
                  label={`Remove ${member.user.email}`}
                  disabled={removeState.fetching}
                  onClick={() => handleRemove(member.userId)}
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner && !addFormOpen ? (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAddFormOpen(true)}
        >
          <Icon icon={UserPlus} size={15} aria-hidden="true" />
          Add member
        </Button>
      ) : null}

      {isOwner && addFormOpen ? (
        <Form onSubmit={handleAdd} className={styles.addForm}>
          <FormError>{formatGraphQLError(addState.error)}</FormError>
          <div className={styles.addFields}>
            <FormField label="Email" htmlFor="member-email">
              <Input id="member-email" name="email" type="email" required />
            </FormField>
            <FormField label="Role" htmlFor="member-role">
              <Select id="member-role" name="role" defaultValue="PLAYER">
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <div className={styles.addActions}>
            <Button type="submit" disabled={addState.fetching}>
              Add member
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddFormOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </Form>
      ) : null}
    </div>
  );
}
