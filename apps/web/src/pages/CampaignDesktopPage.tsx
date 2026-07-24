import { useMemo, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useQuery } from "urql";
import { Link } from "@storyforge/ui";

import { CampaignDocument, MeDocument } from "../gql/graphql";
import { AppCommandPalette } from "../components/AppCommandPalette";
import { DesktopBoard } from "../components/DesktopBoard";
import { ForceOpenEntityListener } from "../components/ForceOpenEntityListener";
import { MobileDesktop } from "../components/MobileDesktop";
import { StartMenu } from "../components/StartMenu";
import { Taskbar } from "../components/Taskbar";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useDesktopWindowsController } from "../hooks/useDesktopWindowsController";
import { useWorkspaceStateSync } from "../hooks/useWorkspaceStateSync";
import { DesktopWindowsContext } from "../lib/DesktopWindowsContext";
import { visibleWindowCatalog } from "../lib/windowCatalog";
import { activeWindowId, buildTaskbarItems } from "../lib/taskbarItems";
import styles from "./CampaignDesktopPage.module.css";

export function CampaignDesktopPage() {
  const { id } = useParams<{ id: string }>();
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Owned here (not inside DesktopBoard) so the taskbar and start menu —
  // siblings of DesktopBoard, not descendants — open and toggle the same
  // windows. `id` is available synchronously from the route; the campaign
  // data it names may still be loading below.
  const desktopWindows = useDesktopWindowsController(id ?? "");
  // KAN-104: loads any previously-saved server state on mount and
  // debounce-syncs local changes back up — on top of, not instead of, the
  // localStorage persistence useDesktopWindowsController already does.
  useWorkspaceStateSync(id ?? "", desktopWindows);
  const [startOpen, setStartOpen] = useState(false);

  const [{ data: meData }] = useQuery({ query: MeDocument });
  const [{ data: campaignData, fetching }] = useQuery({
    query: CampaignDocument,
    variables: { id: id ?? "" },
    pause: !id,
  });

  const currentUserId = meData?.me?.id;
  const campaign = campaignData?.campaign;
  const role = campaign?.members.find(
    (member) => member.userId === currentUserId,
  )?.role;

  const { layout, dynamicWindows, minimize, restoreWindow, bringToFront } =
    desktopWindows;
  const taskbarItems = useMemo(
    () =>
      buildTaskbarItems({
        layout,
        catalog: visibleWindowCatalog(role),
        dynamicWindows,
      }),
    [layout, role, dynamicWindows],
  );

  // Taskbar click follows the convention every desktop shares: restore a
  // minimized window, roll down the one you're already looking at, raise
  // anything else.
  function handleTaskClick(windowId: string) {
    const window = layout[windowId];
    if (!window) {
      return;
    }
    if (window.minimized) {
      restoreWindow(windowId);
      return;
    }
    if (windowId === activeWindowId({ layout })) {
      minimize(windowId);
      return;
    }
    bringToFront(windowId);
  }

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

  return (
    <main className={styles.shell}>
      <DesktopWindowsContext.Provider value={desktopWindows}>
        <div className={styles.desk}>
          {isMobile ? (
            <MobileDesktop role={role} />
          ) : (
            <DesktopBoard campaignId={campaign.id} role={role} />
          )}
        </div>

        {startOpen ? (
          <StartMenu
            campaignId={campaign.id}
            campaignName={campaign.name}
            role={role}
            userEmail={meData?.me?.email}
            onClose={() => setStartOpen(false)}
          />
        ) : null}

        <Taskbar
          items={taskbarItems}
          role={role}
          startOpen={startOpen}
          onStartToggle={() => setStartOpen((current) => !current)}
          onTaskClick={handleTaskClick}
          // The mobile shell shows one panel at a time — there is no desk
          // behind it to peek at.
          onShowDesktop={isMobile ? undefined : desktopWindows.showDesktop}
        />

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
