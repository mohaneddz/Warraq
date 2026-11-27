import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { SchemaPanel } from "../components/setup/SchemaPanel";
import { Button, Input } from "../components/ui/primitives";
import { apiKeysUrl, keyRole, projectRefFrom, projectUrlFrom, saveConnection, type Connection } from "../data/connection";
import { testConnection } from "../data/setupChecks";
import type { SchemaState } from "../data/setupChecks";

type Step = "connect" | "schema" | "admin";
const STEPS: Step[] = ["connect", "schema", "admin"];
const LOCALES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "ar", label: "AR" },
] as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-[#122222]/70 dark:text-white/70">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-snug text-[#122222]/50 dark:text-white/50">{hint}</span>}
    </label>
  );
}

function setLocale(i18n: ReturnType<typeof useTranslation>["i18n"], code: string) {
  void i18n.changeLanguage(code);
  try {
    const stored = JSON.parse(localStorage.getItem("warraq-preferences") ?? "{}");
    localStorage.setItem("warraq-preferences", JSON.stringify({ ...stored, locale: code }));
  } catch {
    // The language still changes for this session if storage is unavailable.
  }
}

/**
 * First-run screen of the public edition. A fresh install has no database, so this collects the
 * user's own Supabase project, helps them create the tables, and makes the first administrator.
 * It deliberately imports nothing that needs the database client, which doesn't exist yet.
 */
export function SetupPage() {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState<Step>("connect");

  const [projectInput, setProjectInput] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [serviceKey, setServiceKey] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [testing, setTesting] = useState(false);

  const [schemaState, setSchemaState] = useState<SchemaState | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [email, setEmail] = useState("");
  const [finishing, setFinishing] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  const ref = projectRefFrom(projectInput);

  // The Rust side answers in English; the two failures a person can fix here get translated.
  const friendlyError = (message: string) => {
    if (message.includes("rejected the secret")) return t("setup.errors.serviceRejected", "Supabase rejected the secret (service role) key. Copy it again from Project Settings, API Keys.");
    if (message.includes("tables are missing")) return t("setup.errors.noTables", "The Warraq tables are missing from this project. Go back and run the script in the SQL editor first.");
    return message;
  };

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const url = projectUrlFrom(projectInput);
    if (!url) return setError(t("setup.errors.badUrl", "That doesn't look like a Supabase project URL. It should look like https://abcdefghijklmnopqrst.supabase.co"));
    if (!anonKey.trim()) return setError(t("setup.errors.noAnonKey", "Paste the publishable key."));
    if (keyRole(anonKey) === "service_role") return setError(t("setup.errors.anonIsSecret", "That is the secret key. The publishable key goes in this box; the secret key goes in the one below."));
    if (!serviceKey.trim()) return setError(t("setup.errors.noServiceKey", "Paste the secret (service role) key. Warraq needs it to create staff accounts."));
    if (keyRole(serviceKey) === "anon") return setError(t("setup.errors.serviceIsPublishable", "That is the publishable key. Paste the secret (service role) key here."));

    setTesting(true);
    const candidate: Connection = { url, anonKey: anonKey.trim() };
    const result = await testConnection(candidate);
    setTesting(false);
    if (result === "ok") {
      setConnection(candidate);
      setStep("schema");
    } else if (result === "badKey") {
      setError(t("setup.errors.badKey", "Supabase rejected the publishable key. Copy it again from Project Settings, API Keys."));
    } else if (result === "notFound") {
      setError(t("setup.errors.notFound", "No project exists at that address. Check the project URL."));
    } else {
      setError(t("setup.errors.unreachable", "Couldn't reach Supabase. Check your internet connection and the project URL."));
    }
  };

  const finish = async (createAdmin: boolean) => {
    if (!connection) return;
    setError(null);
    if (createAdmin) {
      if (username.trim().length < 3) return setError(t("setup.errors.badUsername", "The username needs at least 3 characters."));
      if (password.length < 8) return setError(t("setup.errors.shortPassword", "The password needs at least 8 characters."));
      if (password !== confirm) return setError(t("setup.errors.mismatch", "The two passwords don't match."));
    }
    setFinishing(true);
    try {
      await invoke("save_connection", { projectUrl: connection.url, publishableKey: connection.anonKey, serviceKey: serviceKey.trim() });
      if (createAdmin) {
        await invoke<boolean>("admin_bootstrap_if_needed", { username: username.trim(), password, email: email.trim() || null });
      }
      saveConnection(connection);
      window.location.reload();
    } catch (err) {
      // Don't leave a half finished setup behind: the key was saved before the admin step ran.
      void invoke("clear_connection").catch(() => {});
      setError(friendlyError(String(err)));
      setFinishing(false);
    }
  };

  const stepIndex = STEPS.indexOf(step);
  const stepLabels: Record<Step, string> = {
    connect: t("setup.steps.connect", "Connect"),
    schema: t("setup.steps.schema", "Tables"),
    admin: t("setup.steps.admin", "Administrator"),
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111c19] px-4 py-10">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-white p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] dark:bg-[#1d2926]">
        <div className="mb-6 flex items-center justify-between gap-3 border-b border-black/5 pb-5 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald shadow-md shadow-emerald/20">
              <img src="/brand/warraq-symbol-cream.png" className="h-6 w-6 object-contain" alt="" />
            </div>
            <div>
              <strong className="block font-display text-[18px] font-bold uppercase tracking-widest text-[#122222] dark:text-white">Warraq</strong>
              <span className="text-[11px] font-semibold text-[#122222]/55 dark:text-white/55">{t("setup.title", "First time setup")}</span>
            </div>
          </div>
          <div className="flex gap-1" role="group" aria-label="Language">
            {LOCALES.map((locale) => (
              <button
                key={locale.code}
                type="button"
                onClick={() => setLocale(i18n, locale.code)}
                className={`rounded-md px-2 py-1 text-[11px] font-bold ${i18n.language === locale.code ? "bg-emerald text-white" : "text-[#122222]/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"}`}
              >
                {locale.label}
              </button>
            ))}
          </div>
        </div>

        <ol className="mb-6 flex items-center gap-2 text-[12px] font-bold">
          {STEPS.map((id, index) => (
            <li key={id} className="flex flex-1 items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${index <= stepIndex ? "bg-emerald text-white" : "bg-black/10 text-[#122222]/50 dark:bg-white/10 dark:text-white/50"}`}>
                {index < stepIndex ? <CheckCircle2 size={14} /> : index + 1}
              </span>
              <span className={index === stepIndex ? "text-[#122222] dark:text-white" : "text-[#122222]/45 dark:text-white/45"}>{stepLabels[id]}</span>
            </li>
          ))}
        </ol>

        {step === "connect" && (
          <form onSubmit={(event) => void handleConnect(event)} className="space-y-4">
            <div>
              <h1 className="text-[17px] font-bold text-[#122222] dark:text-white">{t("setup.connect.title", "Connect your Supabase project")}</h1>
              <p className="mt-1 text-[13px] leading-relaxed text-[#122222]/70 dark:text-white/70">
                {t("setup.connect.intro", "Warraq keeps your library in your own Supabase database. Create a free project at supabase.com, then copy the details below from Project Settings, API Keys.")}
              </p>
            </div>
            <Field label={t("setup.connect.projectUrl", "Project URL")} hint={t("setup.connect.projectUrlHint", "Looks like https://abcdefghijklmnopqrst.supabase.co. The 20 character project reference alone works too.")}>
              <Input value={projectInput} onChange={(event) => setProjectInput(event.target.value)} placeholder="https://abcdefghijklmnopqrst.supabase.co" spellCheck={false} autoComplete="off" dir="ltr" />
            </Field>
            <Field label={t("setup.connect.anonKey", "Publishable key")} hint={t("setup.connect.anonKeyHint", "Starts with sb_publishable_ or eyJ. It is safe to expose: the database rules protect your data, not this key.")}>
              <Input value={anonKey} onChange={(event) => setAnonKey(event.target.value)} spellCheck={false} autoComplete="off" dir="ltr" />
            </Field>
            <Field label={t("setup.connect.serviceKey", "Secret key (service role)")} hint={t("setup.connect.serviceKeyHint", "Used only to create and manage staff accounts. It is kept on this computer, in Windows Credential Manager, and never reaches the app's screens.")}>
              <Input type="password" value={serviceKey} onChange={(event) => setServiceKey(event.target.value)} spellCheck={false} autoComplete="off" dir="ltr" />
            </Field>
            {ref && (
              <button
                type="button"
                onClick={() => void import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(apiKeysUrl(ref))).catch(() => {})}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1a4d40] hover:underline dark:text-[#1b9277]"
              >
                <ExternalLink size={13} /> {t("setup.connect.openKeys", "Open this project's API keys page")}
              </button>
            )}
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={testing}>
                {testing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {testing ? t("setup.connect.testing", "Testing…") : t("setup.connect.test", "Test connection")}
              </Button>
            </div>
          </form>
        )}

        {step === "schema" && connection && (
          <div className="space-y-4">
            <div>
              <h1 className="text-[17px] font-bold text-[#122222] dark:text-white">{t("setup.schema.title", "Create the tables")}</h1>
              <p className="mt-1 text-[13px] leading-relaxed text-[#122222]/70 dark:text-white/70">
                {t("setup.schema.intro", "A new project is empty, so Warraq needs its tables first. One script builds all of them. Run it once, on this project only.")}
              </p>
            </div>
            <SchemaPanel connection={connection} onState={setSchemaState} autoCheck />
            <div className="flex justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep("connect")}>
                <ArrowLeft size={14} className="rtl:rotate-180" /> {t("setup.back", "Back")}
              </Button>
              <Button type="button" disabled={schemaState !== "installed"} onClick={() => { setError(null); setStep("admin"); }}>
                {t("setup.continue", "Continue")} <ArrowRight size={14} className="rtl:rotate-180" />
              </Button>
            </div>
          </div>
        )}

        {step === "admin" && connection && (
          <form onSubmit={(event) => { event.preventDefault(); void finish(true); }} className="space-y-4">
            <div>
              <h1 className="text-[17px] font-bold text-[#122222] dark:text-white">{t("setup.admin.title", "Create the administrator account")}</h1>
              <p className="mt-1 text-[13px] leading-relaxed text-[#122222]/70 dark:text-white/70">
                {t("setup.admin.intro", "This is the account you will sign in with. You can add librarians later in Settings, Users and Access.")}
              </p>
            </div>
            <Field label={t("setup.admin.username", "Username")}>
              <Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="off" dir="ltr" />
            </Field>
            <div className="grid grid-cols-2 items-start gap-3">
              <Field label={t("setup.admin.password", "Password")} hint={t("setup.admin.passwordHint", "At least 8 characters.")}>
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" dir="ltr" />
              </Field>
              <Field label={t("setup.admin.confirm", "Confirm password")}>
                <Input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" dir="ltr" />
              </Field>
            </div>
            <Field label={t("setup.admin.email", "Email (optional)")}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="off" dir="ltr" />
            </Field>
            <div className="flex items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep("schema")} disabled={finishing}>
                <ArrowLeft size={14} className="rtl:rotate-180" /> {t("setup.back", "Back")}
              </Button>
              <Button type="submit" disabled={finishing}>
                {finishing && <Loader2 size={14} className="animate-spin" />}
                {finishing ? t("setup.admin.finishing", "Setting up…") : t("setup.admin.finish", "Finish setup")}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => void finish(false)}
              disabled={finishing}
              className="block text-[12px] font-semibold text-[#122222]/55 underline-offset-2 hover:underline dark:text-white/55"
            >
              {t("setup.admin.skip", "This project already has an administrator. Skip this step.")}
            </button>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-5 break-words rounded-xl bg-red-50 px-3 py-2.5 text-[13px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
