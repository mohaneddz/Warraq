import { useEffect, useState } from "react";
import { useUiStore } from "../store/uiStore";

/** Resolves the effective light/dark mode, mirroring AppShell's own theme-application logic. */
export function useIsDark(): boolean {
  const theme = useUiStore((s) => s.preferences.theme);
  const [isDark, setIsDark] = useState(() =>
    theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const resolve = () => setIsDark(theme === "dark" || (theme === "system" && mq.matches));
    resolve();
    mq.addEventListener("change", resolve);
    return () => mq.removeEventListener("change", resolve);
  }, [theme]);

  return isDark;
}

/** Builds the path to a themed illustration in /public/assets, e.g. assetUrl("dashboard-clock", true). */
export function assetUrl(key: string, isDark: boolean): string {
  return `/assets/warraq-${key}-${isDark ? "dark" : "light"}.png`;
}

/** Convenience hook returning the resolved URL for a themed illustration key. */
export function useThemedAsset(key: string): string {
  const isDark = useIsDark();
  return assetUrl(key, isDark);
}
