import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertTriangle, Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import schemaSql from "../../assets/schema.sql?raw";
import { projectRefFrom, sqlEditorUrl, type Connection } from "../../data/connection";
import { checkSchema, type SchemaState } from "../../data/setupChecks";
import { Button } from "../ui/primitives";

function downloadSchemaFile() {
  const url = URL.createObjectURL(new Blob([schemaSql], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "warraq_schema.sql";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Everything needed to put Warraq's tables into a Supabase project: the bundled script (copy or
 * save), a link to the project's SQL editor, and a check that the tables are there afterwards.
 */
export function SchemaPanel({ connection, onState, autoCheck = false }: { connection: Connection; onState?: (state: SchemaState) => void; autoCheck?: boolean }) {
  const { t } = useTranslation();
  const [state, setState] = useState<SchemaState | null>(null);
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const result = await checkSchema(connection);
    setState(result);
    setChecking(false);
    onState?.(result);
  }, [connection, onState]);

  useEffect(() => {
    if (autoCheck) void check();
  }, [autoCheck, check]);

  const copy = async () => {
    await navigator.clipboard.writeText(schemaSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const openEditor = () => {
    const ref = projectRefFrom(connection.url);
    if (!ref) return;
    void import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(sqlEditorUrl(ref))).catch(() => {});
  };

  return (
    <div>
      <ol className="space-y-2 text-[13px] text-[#122222]/80 dark:text-white/80 list-decimal ps-5">
        <li>{t("setup.schema.step1", "Copy the script below, or save it as a file.")}</li>
        <li>{t("setup.schema.step2", "Open your project's SQL editor, paste the script and press Run.")}</li>
        <li>{t("setup.schema.step3", "Come back here and press Check.")}</li>
      </ol>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => void copy()}>
          {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          {copied ? t("setup.schema.copied", "Copied") : t("setup.schema.copy", "Copy SQL")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            downloadSchemaFile();
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }}
        >
          {saved ? <CheckCircle2 size={14} /> : <Download size={14} />}
          {saved ? t("setup.schema.saved", "Saved to Downloads") : t("setup.schema.save", "Save as file")}
        </Button>
        <Button type="button" variant="secondary" onClick={openEditor}>
          <ExternalLink size={14} />
          {t("setup.schema.openEditor", "Open SQL editor")}
        </Button>
        <Button type="button" onClick={() => void check()} disabled={checking}>
          <RefreshCw size={14} className={checking ? "animate-spin" : undefined} />
          {checking ? t("setup.schema.checking", "Checking…") : t("setup.schema.check", "Check")}
        </Button>
      </div>

      {state === "installed" && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-[#1a4d40] dark:text-[#1b9277]">
          <CheckCircle2 size={15} /> {t("setup.schema.installed", "The tables are in place.")}
        </p>
      )}
      {state === "missing" && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-[#b96f3e]">
          <AlertTriangle size={15} /> {t("setup.schema.missing", "No tables found yet. Run the script in the SQL editor, then check again.")}
        </p>
      )}
      {state === "unknown" && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-red-600">
          <AlertTriangle size={15} /> {t("setup.schema.unknown", "Couldn't tell. Check your connection and try again.")}
        </p>
      )}
    </div>
  );
}
