import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "urql";
import { Button } from "@storyforge/ui";

import { CampaignsDocument, LogoutDocument, MeDocument } from "../gql/graphql";
import { CreateCampaignDialog } from "../components/CreateCampaignDialog";
import { ManageCampaignModal } from "../components/ManageCampaignModal";
import styles from "./DashboardPage.module.css";

export function DashboardPage() {
  const navigate = useNavigate();
  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignsData, fetching }, reexecuteCampaigns] = useQuery({
    query: CampaignsDocument,
  });
  const [, logout] = useMutation(LogoutDocument);
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [managingCampaignId, setManagingCampaignId] = useState<string | null>(
    null,
  );

  const currentUserId = meData?.me?.id;
  const campaigns = campaignsData?.campaigns ?? [];
  const managingCampaign = campaigns.find(
    (campaign) => campaign.id === managingCampaignId,
  );

  async function handleLogout() {
    await logout({});
    navigate("/login");
  }

  function handleCreated() {
    setCreateOpen(false);
    reexecuteCampaigns({ requestPolicy: "network-only" });
  }

  function handleManageClosed() {
    setManagingCampaignId(null);
    reexecuteCampaigns({ requestPolicy: "network-only" });
  }

  return (
    <main>
      <header className={styles.header}>
        <div>
          <h1>Campaigns</h1>
          <p className={styles.lede}>Your worlds, sessions, and story.</p>
        </div>
        <div className={styles.headerActions}>
          <Button onClick={() => setCreateOpen(true)}>New campaign</Button>
          <Button variant="secondary" onClick={handleLogout}>
            Log out
          </Button>
        </div>
      </header>

      {fetching ? <p className={styles.status}>Loading campaigns…</p> : null}

      {!fetching && campaigns.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No campaigns yet</p>
          <p className={styles.emptyBody}>
            Create your first campaign to start building.
          </p>
          <Button onClick={() => setCreateOpen(true)}>New campaign</Button>
        </div>
      ) : null}

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
              <div className={styles.actions}>
                {role === "OWNER" ? (
                  <Button
                    variant="secondary"
                    onClick={() => setManagingCampaignId(campaign.id)}
                  >
                    Manage
                  </Button>
                ) : null}
                <Button onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                  Enter
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <CreateCampaignDialog
        open={isCreateOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {managingCampaign ? (
        <ManageCampaignModal
          open
          campaign={managingCampaign}
          onClose={() => setManagingCampaignId(null)}
          onUpdated={handleManageClosed}
          onArchived={handleManageClosed}
        />
      ) : null}
    </main>
  );
}
