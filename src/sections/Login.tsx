import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, LogIn, KeyRound } from "lucide-react";
import { login as loginRequest, changeOwnPassword } from "../data/auth";
import { useAuthStore } from "../store/authStore";
import { Button, Input } from "../components/ui/primitives";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#111c19] dark:bg-[#0b1311] px-4 py-12 relative overflow-hidden select-none">
      {/* Paper texture overlay */}
      <div className="bg-paper-texture-overlay opacity-20" />

      {/* Decorative ambient radial glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-[#1b4332]/35 via-[#b96f3e]/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] bg-[#104f55]/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-[#b96f3e]/25 rounded-full blur-3xl pointer-events-none" />

      {/* Elegant SVG Background Patterns */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.08] text-[#f0ebe1]">
        {/* Top Right - Open Book & Compass Rosette */}
        <svg className="absolute -top-16 -right-16 w-[580px] h-[580px]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.35">
          <circle cx="50" cy="50" r="48" strokeDasharray="1,2" />
          <circle cx="50" cy="50" r="42" strokeDasharray="3,3" />
          <circle cx="50" cy="50" r="34" />
          <path d="M50,75 C60,67 72,70 80,72 L80,22 C72,20 60,17 50,25 C40,17 28,20 20,22 L20,72 C28,70 40,67 50,75 Z" />
          <path d="M50,25 L50,75" />
          <path d="M54,30 C62,24 70,26 76,27" />
          <path d="M54,38 C62,32 70,34 76,35" />
          <path d="M54,46 C62,40 70,42 76,43" />
          <path d="M54,54 C62,48 70,50 76,51" />
          <path d="M46,30 C38,24 30,26 24,27" />
          <path d="M46,38 C38,32 30,34 24,35" />
          <path d="M46,46 C38,40 30,42 24,43" />
          <path d="M46,54 C38,48 30,50 24,51" />
        </svg>

        {/* Bottom Left - Geometric Scribal Rosette Star */}
        <svg className="absolute -bottom-24 -left-24 w-[600px] h-[600px]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.3">
          <circle cx="50" cy="50" r="48" strokeDasharray="2,2" />
          <circle cx="50" cy="50" r="40" />
          <circle cx="50" cy="50" r="30" strokeDasharray="1,1" />
          <rect x="25" y="25" width="50" height="50" transform="rotate(0 50 50)" />
          <rect x="25" y="25" width="50" height="50" transform="rotate(15 50 50)" />
          <rect x="25" y="25" width="50" height="50" transform="rotate(30 50 50)" />
          <rect x="25" y="25" width="50" height="50" transform="rotate(45 50 50)" />
          <rect x="25" y="25" width="50" height="50" transform="rotate(60 50 50)" />
          <rect x="25" y="25" width="50" height="50" transform="rotate(75 50 50)" />
          <circle cx="50" cy="50" r="14" />
          <circle cx="50" cy="50" r="6" />
        </svg>
      </div>

      {/* Login Card Container */}
      <div className="max-w-md w-full bg-white dark:bg-[#1d2926] p-8 rounded-3xl border border-black/10 dark:border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col relative z-10 transition-all">
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-black/5 dark:border-white/5">
          <div className="w-12 h-12 bg-emerald rounded-2xl flex items-center justify-center shadow-md shadow-emerald/20 shrink-0">
            <img src="/brand/warraq-symbol-cream.png" className="h-7 w-7 object-contain" alt="" />
          </div>
          <div>
            <strong className="block text-[19px] font-bold text-[#122222] dark:text-white tracking-widest uppercase font-display">WARRAQ</strong>
            <span className="text-[10px] text-[#b96f3e] dark:text-[#c58a59] tracking-wider uppercase font-bold">Library Management System</span>
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
