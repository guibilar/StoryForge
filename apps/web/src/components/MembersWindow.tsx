import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Button, Form, FormError, FormField, Input } from "@storyforge/ui";

import {
  AddCampaignMemberDocument,
  CampaignDocument,
  MeDocument,
  RemoveCampaignMemberDocument,
  UpdateCampaignMemberRoleDocument,
} from "../gql/graphql";
import type { CampaignRole } from "../gql/graphql";
import { formatGraphQLError } from "../lib/graphqlError";
import styles from "./MembersWindow.module.css";

const ROLES: CampaignRole[] = [
  "OWNER",
  "STORYTELLER",
  "CO_STORYTELLER",
  "PLAYER",
  "OBSERVER",
];

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
    if (!campaignId) {
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
      refetch();
    }
  }

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
              <select
                className={styles.roleSelect}
                aria-label={`Role for ${member.user.email}`}
                value={member.role}
                onChange={(event) =>
                  handleRoleChange(
                    member.userId,
                    event.target.value as CampaignRole,
                  )
                }
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            ) : (
              <span className={styles.role}>{member.role}</span>
            )}
            {isOwner ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleRemove(member.userId)}
              >
                Remove
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <Form onSubmit={handleAdd} className={styles.addForm}>
          <FormError>{formatGraphQLError(addState.error)}</FormError>
          <FormField label="Email" htmlFor="member-email">
            <Input id="member-email" name="email" type="email" required />
          </FormField>
          <FormField label="Role" htmlFor="member-role">
            <select
              id="member-role"
              name="role"
              defaultValue="PLAYER"
              className={styles.roleSelect}
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </FormField>
          <Button type="submit" disabled={addState.fetching}>
            Add member
          </Button>
        </Form>
      ) : null}
    </div>
  );
}
