export interface Titleable {
  title: string;
  arabic_title?: string | null;
  subtitle?: string | null;
}

export interface DisplayTitleResult {
  main: string;
  sub?: string;
}

/**
 * Returns primary and secondary display titles based on the user's title preference.
 * - "original": Main title is `title`, secondary is `arabic_title` or `subtitle`.
 * - "arabic": Main title is `arabic_title` (if available), secondary is `title`.
 */
export function getDisplayTitle(
  item: Titleable,
  preference: "original" | "arabic" = "original"
): DisplayTitleResult {
  const hasArabic = Boolean(item.arabic_title && item.arabic_title.trim());

  if (preference === "arabic" && hasArabic) {
    const main = item.arabic_title!.trim();
    const sub = item.title !== main ? item.title : item.subtitle || undefined;
    return { main, sub };
  }

  const main = item.title;
  const sub = hasArabic ? item.arabic_title! : item.subtitle || undefined;
  return { main, sub };
}
