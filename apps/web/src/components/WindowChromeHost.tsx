import { useMemo, useState } from "react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { Window } from "@storyforge/ui";

import { WindowChromeContext } from "../lib/WindowChromeContext";
import type { WindowChromeApi } from "../lib/WindowChromeContext";

export interface WindowChromeHostProps {
  title: string;
  style?: CSSProperties;
  className?: string;
  onClose: () => void;
  onPointerDownCapture?: (event: PointerEvent<HTMLDivElement>) => void;
  onTitleBarPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onResizeHandlePointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  autoFocus?: boolean;
  children: ReactNode;
}

// Owns the isLoading/onRefresh state for one window's <Window> chrome, fed
// by whatever content is mounted inside it via WindowChromeContext — see
// that file for why this indirection exists (KAN-110).
export function WindowChromeHost({
  children,
  ...windowProps
}: WindowChromeHostProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [onRefresh, setOnRefresh] = useState<(() => void) | undefined>(
    undefined,
  );
  // setIsLoading/setOnRefresh are stable (useState setters), so this only
  // needs to be built once — NOT memoized would hand consumers a new object
  // every render, which forces every useWindowChromeSync consumer to
  // re-render (context propagation bypasses the normal children-reference
  // bailout), which redefines their onRefresh closure, which re-fires that
  // effect, which calls setOnRefresh again — an infinite loop in practice,
  // not just a perf hit.
  const chromeApi = useMemo<WindowChromeApi>(
    () => ({ setLoading: setIsLoading, setOnRefresh }),
    [],
  );

  return (
    <Window {...windowProps} isLoading={isLoading} onRefresh={onRefresh}>
      <WindowChromeContext.Provider value={chromeApi}>
        {children}
      </WindowChromeContext.Provider>
    </Window>
  );
}
