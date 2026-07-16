import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Button } from "@storyforge/ui";

import { CampaignsDocument, LogoutDocument, MeDocument } from "../gql/graphql";
import { CreateCampaignDialog } from "../components/CreateCampaignDialog";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignsData, fetching }, reexecuteCampaigns] = useQuery({
    query: CampaignsDocument,
  });
  const [, logout] = useMutation(LogoutDocument);
  const [isCreateOpen, setCreateOpen] = useState(false);

  const currentUserId = meData?.me?.id;
  const campaigns = campaignsData?.campaigns ?? [];

  async function handleLogout() {
    await logout({});
    navigate("/login");
  }

  function handleCreated() {
    setCreateOpen(false);
    reexecuteCampaigns({ requestPolicy: "network-only" });
  }

  return (
    <main>
      <header className={styles.header}>
        <h1>Dashboard</h1>
        <Button variant="secondary" onClick={handleLogout}>
          Log out
        </Button>
      </header>

      <Button onClick={() => setCreateOpen(true)}>New campaign</Button>

      {fetching ? <p>Loading campaigns…</p> : null}

      <ul className={styles.list}>
        {campaigns.map((campaign) => {
          const role = campaign.members.find(
            (member) => member.userId === currentUserId,
          )?.role;

          return (
            <li key={campaign.id} className={styles.card}>
              <h2>{campaign.name}</h2>
              {campaign.description ? <p>{campaign.description}</p> : null}
              <p className={styles.meta}>
                {campaign.members.length}{" "}
                {campaign.members.length === 1 ? "member" : "members"}
                {role ? ` · ${role}` : ""}
              </p>
              {role === "OWNER" ? (
                // TODO(KAN-82): wire this button to the manage-campaign modal
                <Button variant="secondary" disabled>
                  Manage
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <CreateCampaignDialog
        open={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </main>
  );
}
