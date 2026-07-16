import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "urql";
import { Link } from "@storyforge/ui";

import { CampaignDocument, MeDocument } from "../gql/graphql";
import { DesktopBoard } from "../components/DesktopBoard";
import { MobileDesktop } from "../components/MobileDesktop";
import { useMediaQuery } from "../hooks/useMediaQuery";
import styles from "./CampaignDesktopPage.module.css";

export function CampaignDesktopPage() {
  const { id } = useParams<{ id: string }>();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData, fetching }] = useQuery({
    query: CampaignDocument,
    variables: { id: id ?? "" },
    pause: !id,
  });

  const currentUserId = meData?.me?.id;
  const campaign = campaignData?.campaign;

  if (fetching) {
    return (
      <main>
        <p>Loading campaign…</p>
      </main>
    );
  }

  if (!campaign) {
    return (
      <main>
        <p>Campaign not found.</p>
        <Link as={RouterLink} to="/dashboard">
          Back to dashboard
        </Link>
      </main>
    );
  }

  const role = campaign.members.find(
    (member) => member.userId === currentUserId,
  )?.role;

  return (
    <main>
      <header className={styles.header}>
        <Link as={RouterLink} to="/dashboard">
          ← Dashboard
        </Link>
        <p className={styles.crumb}>
          {campaign.name}
          {role ? ` · ${role}` : ""}
        </p>
      </header>

      {isMobile ? <MobileDesktop /> : <DesktopBoard campaignId={campaign.id} />}
    </main>
  );
}
