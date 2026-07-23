import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Icon } from "@storyforge/ui";

import type { CampaignRole } from "../gql/graphql";
import { useThemePreference } from "../hooks/useThemePreference";
import type { ThemeMode } from "../hooks/useThemePreference";
import styles from "./Taskbar.module.css";

export type TaskState = "active" | "open" | "minimized";

export interface TaskbarItem {
  id: string;
  title: string;
  icon?: LucideIcon;
  state: TaskState;
}

export interface TaskbarProps {
  items: TaskbarItem[];
  role?: CampaignRole;
  startOpen: boolean;
  onStartToggle: () => void;
  // Clicking a task button focuses it, minimizes it if it is already focused,
  // or restores it if it is minimized — the caller owns which, since only it
  // knows the window state.
  onTaskClick: (id: string) => void;
  // Omitted on the mobile shell, which shows one panel at a time and has no
  // desktop to peek at.
  onShowDesktop?: () => void;
}

const ROLE_LABEL: Record<CampaignRole, string> = {
  OWNER: "Owner",
  STORYTELLER: "Storyteller",
  CO_STORYTELLER: "Co-Storyteller",
  PLAYER: "Player",
  OBSERVER: "Observer",
};

const THEME_ICON: Record<ThemeMode, LucideIcon> = {
  auto: Monitor,
  light: Sun,
  dark: Moon,
};

const THEME_LABEL: Record<ThemeMode, string> = {
  auto: "Theme: following system",
  light: "Theme: light",
  dark: "Theme: dark",
};

function useClock(): { time: string; date: string } {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Minute resolution is all the display has, so this only needs to be
    // roughly minute-accurate — a 15s tick keeps it within a quarter minute
    // without waking the tab every second.
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  return {
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    date: now.toLocaleDateString([], { day: "2-digit", month: "short" }),
  };
}

// The desktop shell's persistent bar: start button, one button per open
// window, and the tray. Purely presentational — both CampaignDesktopPage's
// window shell and MobileDesktop build the item list and hand it in.
export function Taskbar({
  items,
  role,
  startOpen,
  onStartToggle,
  onTaskClick,
  onShowDesktop,
}: TaskbarProps) {
  const { mode, cycle } = useThemePreference();
  const { time, date } = useClock();

  return (
    <div className={styles.bar}>
      <button
        type="button"
        className={styles.start}
        // Lets the start menu tell "clicked outside" from "clicked the
        // button that toggles me" without reaching for a ref across
        // components.
        data-start
        aria-expanded={startOpen}
        aria-haspopup="dialog"
        onClick={onStartToggle}
      >
        <span className={styles.sigil} aria-hidden="true">
          S
        </span>
        <span className={styles.startLabel}>StoryForge</span>
      </button>

      <div className={styles.divider} aria-hidden="true" />

      <div className={styles.tasks} role="group" aria-label="Open windows">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.task}
            data-state={item.state}
            // Pressed reads as "this window is the one you're looking at",
            // which is exactly what the active state means here.
            aria-pressed={item.state === "active"}
            title={item.title}
            onClick={() => onTaskClick(item.id)}
          >
            {item.icon ? (
              <Icon icon={item.icon} size={15} aria-hidden="true" />
            ) : null}
            <span className={styles.taskLabel}>{item.title}</span>
          </button>
        ))}
      </div>

      <div className={styles.divider} aria-hidden="true" />

      <div className={styles.tray}>
        {role ? (
          <span className={styles.roleChip} title="Your role in this campaign">
            {ROLE_LABEL[role]}
          </span>
        ) : null}
        <button
          type="button"
          className={styles.trayButton}
          title={THEME_LABEL[mode]}
          aria-label={THEME_LABEL[mode]}
          onClick={cycle}
        >
          <Icon icon={THEME_ICON[mode]} size={15} aria-hidden="true" />
        </button>
        <div className={styles.clock}>
          <span className={styles.clockTime}>{time}</span>
          <span className={styles.clockDate}>{date}</span>
        </div>
        {onShowDesktop ? (
          <button
            type="button"
            className={styles.peek}
            title="Show desktop"
            aria-label="Show desktop"
            onClick={onShowDesktop}
          />
        ) : null}
      </div>
    </div>
  );
}
