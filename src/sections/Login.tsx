import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, LogIn, KeyRound } from "lucide-react";
import { login as loginRequest, changeOwnPassword } from "../data/auth";
import { useAuthStore } from "../store/authStore";
import { Button, Input } from "../components/ui/primitives";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9F8F4] dark:bg-[#111d1a] px-4 py-8 relative overflow-hidden">
      <div className="bg-paper-texture-overlay" />
      <div className="max-w-md w-full bg-white dark:bg-[#1d2926] p-8 rounded-2xl border border-black/5 dark:border-white/5 shadow-card flex flex-col relative z-10">
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-black/5 dark:border-white/5">
          <div className="w-12 h-12 bg-emerald rounded-xl flex items-center justify-center shadow-inner">
            <img src="/brand/warraq-symbol-cream.png" className="h-8 w-8 object-contain" alt="" />
          </div>
          <div>
            <strong className="block text-[18px] font-bold text-[#122222] dark:text-white tracking-widest uppercase font-display">WARRAQ</strong>
            <span className="text-[11px] text-[#122222]/50 dark:text-white/50 tracking-wider uppercase font-semibold">Library Management System</span>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const setUser = useAuthStore((s) => s.setUser);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await loginRequest(username, password);
      setUser(user);
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="font-display text-[24px] font-bold text-[#122222] dark:text-white leading-tight">{t("auth.signInTitle")}</h1>
        <p className="text-[13px] text-[#122222]/60 dark:text-white/60 mt-1">{t("auth.signInSubtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block font-semibold">
          <span>{t("auth.username")}</span>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
            required
            className="mt-1.5"
          />
        </label>
        <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block font-semibold">
          <span>{t("auth.password")}</span>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1.5"
          />
        </label>

        {error && (
          <p className="text-[12px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 !py-3">
          <LogIn size={16} /> {submitting ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>

      <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#122222]/50 dark:text-white/50 mt-6">
        <ShieldCheck size={14} className="text-emerald-600" /> {t("onboarding.security")}
      </p>
    </Shell>
  );
}

/** Mandatory gate shown when the signed-in user still has must_change_password set. */
export function ForcedPasswordChangePage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError(t("settings.account.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("settings.account.passwordMismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await changeOwnPassword(currentPassword, newPassword);
      if (user) setUser({ ...user, must_change_password: false });
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="font-display text-[24px] font-bold text-[#122222] dark:text-white leading-tight">{t("auth.forcedChangeTitle")}</h1>
        <p className="text-[13px] text-[#122222]/60 dark:text-white/60 mt-1">{t("auth.forcedChangeSubtitle", { name: user?.full_name })}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block font-semibold">
          <span>{t("settings.account.currentPassword")}</span>
          <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoFocus autoComplete="current-password" required className="mt-1.5" />
        </label>
        <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block font-semibold">
          <span>{t("settings.account.newPassword")}</span>
          <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={8} className="mt-1.5" />
        </label>
        <label className="text-[11px] font-bold text-[#122222]/60 dark:text-white/60 uppercase tracking-wider block font-semibold">
          <span>{t("settings.account.confirmPassword")}</span>
          <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} className="mt-1.5" />
        </label>

        {error && (
          <p className="text-[12px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <Button type="submit" disabled={submitting} className="w-full flex items-center justify-center gap-2 !py-3">
          <KeyRound size={16} /> {submitting ? t("settings.account.saving") : t("settings.account.savePassword")}
        </Button>
      </form>
    </Shell>
  );
}
