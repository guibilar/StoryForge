import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "urql";
import { Link } from "@storyforge/ui";

import { CampaignDocument, MeDocument } from "../gql/graphql";
import { AppCommandPalette } from "../components/AppCommandPalette";
import { DesktopBoard } from "../components/DesktopBoard";
import { EntitySidebar } from "../components/EntitySidebar";
import { MobileDesktop } from "../components/MobileDesktop";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useDesktopWindowsController } from "../hooks/useDesktopWindowsController";
import { useWorkspaceStateSync } from "../hooks/useWorkspaceStateSync";
import { DesktopWindowsContext } from "../lib/DesktopWindowsContext";
import styles from "./CampaignDesktopPage.module.css";

export function CampaignDesktopPage() {
  const { id } = useParams<{ id: string }>();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Owned here (not inside DesktopBoard) so EntitySidebar — a sibling of
  // DesktopBoard, not a descendant — can open/toggle the same windows. `id`
  // is available synchronously from the route; the campaign data it names
  // may still be loading below.
  const desktopWindows = useDesktopWindowsController(id ?? "");
  // KAN-104: loads any previously-saved server state on mount and
  // debounce-syncs local changes back up — on top of, not instead of, the
  // localStorage persistence useDesktopWindowsController already does.
  useWorkspaceStateSync(id ?? "", desktopWindows);

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

      <DesktopWindowsContext.Provider value={desktopWindows}>
        {isMobile ? (
          <MobileDesktop role={role} />
        ) : (
          <div className={styles.deskLayout}>
            <EntitySidebar campaignId={campaign.id} role={role} />
            <DesktopBoard role={role} />
          </div>
        )}
        <AppCommandPalette campaignId={campaign.id} role={role} />
      </DesktopWindowsContext.Provider>
    </main>
  );
}
