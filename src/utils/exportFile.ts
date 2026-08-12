import JSZip from "jszip";
import { toast } from "sonner";

/** Escapes a single CSV field (quote-wrap when it contains a comma, quote, or newline). */
export function csvField(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Builds one CSV document from a header row + data rows. Prefixed with a UTF-8 BOM for Excel. */
export function buildCsv(columns: string[], rows: (string | number)[][]): string {
  return "﻿" + [columns, ...rows].map((r) => r.map(csvField).join(",")).join("\n");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Best-effort: open the OS Downloads folder (Tauri desktop only; silently no-ops in a browser). */
export async function openDownloadsFolder(): Promise<void> {
  try {
    const { downloadDir } = await import("@tauri-apps/api/path");
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(await downloadDir());
  } catch (e) {
    console.warn("Could not open the downloads folder", e);
  }
}

/**
 * Downloads a blob and shows a success toast that names the file and offers an "Open folder"
 * action (which reveals the Downloads folder on desktop). Centralises the "export done + where
 * is it + open it" experience for CSV/ZIP exports.
 */
export function exportBlobWithToast(blob: Blob, filename: string, message: string, openLabel: string) {
  triggerDownload(blob, filename);
  toast.success(message, {
    duration: 8000,
    action: { label: openLabel, onClick: () => void openDownloadsFolder() },
  });
}

/** Bundles several named CSV documents into a single .zip and exports it. */
export async function exportCsvZip(
  zipName: string,
  files: { name: string; columns: string[]; rows: (string | number)[][] }[],
  message: string,
  openLabel: string,
) {
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, buildCsv(f.columns, f.rows));
  const blob = await zip.generateAsync({ type: "blob" });
  exportBlobWithToast(blob, zipName, message, openLabel);
}
