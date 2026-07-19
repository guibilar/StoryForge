import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "urql";
import { ArrowLeft } from "lucide-react";
import { Icon, Link } from "@storyforge/ui";

import { CampaignDocument, MeDocument } from "../gql/graphql";
import { AppCommandPalette } from "../components/AppCommandPalette";
import { DesktopBoard } from "../components/DesktopBoard";
import { EntitySidebar } from "../components/EntitySidebar";
import { ForceOpenEntityListener } from "../components/ForceOpenEntityListener";
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
    <main className={styles.deskMain}>
      <header className={styles.header}>
        <Link as={RouterLink} to="/dashboard">
          <Icon icon={ArrowLeft} size={15} aria-hidden="true" />
          Dashboard
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
            <div className={styles.sidebarPanel}>
              <EntitySidebar campaignId={campaign.id} role={role} />
            </div>
            <DesktopBoard role={role} />
          </div>
        )}
        <AppCommandPalette campaignId={campaign.id} role={role} />
        {/* KAN-133 side A: always mounted regardless of which window has
            focus, same as AppCommandPalette above — every campaign member
            needs to receive a Storyteller's force-open broadcast, not just
            whoever's looking at a particular window. */}
        <ForceOpenEntityListener campaignId={campaign.id} />
      </DesktopWindowsContext.Provider>
    </main>
  );
}
