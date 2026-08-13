import { useMemo } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Three "alike" legal documents (Terms, Privacy, Licenses) rendered by one shared layout and
 * selected by the `:doc` route param. Linked from Settings → About → Legal.
 */

interface LegalSection {
  heading: string;
  body: string[];
}
interface LegalDoc {
  key: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  sections: LegalSection[];
}

const OWNER = "MANAA Mohaned";
const INSTITUTION = "Mustapha Pacha University Hospital Center (CHU Mustapha Pacha), Algiers";
const YEAR = "2026";

function buildDocs(): Record<string, LegalDoc> {
  const terms: LegalDoc = {
    key: "terms",
    title: "Terms of Service",
    subtitle: "The conditions governing your use of Warraq.",
    icon: FileText,
    sections: [
      {
        heading: "1. Grant of use",
        body: [
          `Warraq is proprietary software owned by ${OWNER}. It is provided free of charge for the exclusive use of the ${INSTITUTION} and its authorized library staff.`,
          "No fee is charged to the hospital for operating the software within its own library.",
        ],
      },
      {
        heading: "2. Restrictions",
        body: [
          "You may NOT copy, redistribute, sublicense, sell, rent, publish, or otherwise make the software available to any other institution, organization, or individual outside the hospital named above without the prior, explicit, written permission of the owner.",
          "You may not remove or alter any copyright, branding, or authorship notices.",
        ],
      },
      {
        heading: "3. Legal consequences",
        body: [
          "Any distribution, reproduction, or commercial exploitation of Warraq without the owner's written permission constitutes a breach of these terms and an infringement of intellectual-property rights, and will result in legal consequences.",
        ],
      },
      {
        heading: "4. Data responsibility",
        body: [
          "The hospital is responsible for the library data it enters and for maintaining its own backups. The software is provided \"as is\", without warranty of any kind, to the extent permitted by applicable law.",
        ],
      },
      {
        heading: "5. Contact",
        body: [
          "For permissions, licensing beyond the hospital, or any question about these terms, contact the owner at https://mohaned.space/.",
        ],
      },
    ],
  };

  const privacy: LegalDoc = {
    key: "privacy",
    title: "Privacy Policy",
    subtitle: "How Warraq handles the data you store in it.",
    icon: ShieldCheck,
    sections: [
      {
        heading: "1. What data is stored",
        body: [
          "Warraq stores the library records you enter: catalogue items, members, loans, reservations, shelves, and audit logs. This data is held in the hospital's own Supabase database.",
        ],
      },
      {
        heading: "2. Where it lives",
        body: [
          "Your library data stays within the database configured for this installation. The desktop application reads and writes to that database only; it does not send your library data to the software owner.",
        ],
      },
      {
        heading: "3. Third-party lookups",
        body: [
          "When you enrich a catalogue record, the title or ISBN you look up is sent to the external metadata providers you enable (Google Books, Open Library, and Groq). Only the search query is shared, never your members' personal data.",
        ],
      },
      {
        heading: "4. Personal data of members",
        body: [
          "Member names, contact details, and borrowing history are used solely to operate the library. They are never sold or shared with third parties. Handle this data in accordance with the hospital's own data-protection obligations.",
        ],
      },
      {
        heading: "5. Local preferences",
        body: [
          "Interface preferences (theme, language, page size, API keys) are stored locally on this device only.",
        ],
      },
    ],
  };

  const licenses: LegalDoc = {
    key: "licenses",
    title: "Open Source Licenses",
    subtitle: "The software Warraq is built with.",
    icon: Scale,
    sections: [
      {
        heading: "Warraq license",
        body: [
          `Warraq itself is proprietary software © ${YEAR} ${OWNER}. All rights reserved. It is licensed free of charge to the ${INSTITUTION} only (see Terms of Service).`,
        ],
      },
      {
        heading: "Bundled open-source components",
        body: [
          "Warraq gratefully builds on open-source projects, each under its own license:",
          "• React: MIT License",
          "• Tauri: MIT / Apache-2.0",
          "• Vite: MIT License",
          "• Tailwind CSS: MIT License",
          "• TanStack Query: MIT License",
          "• Recharts: MIT License",
          "• lucide-react (icons): ISC License",
          "• Supabase JS: MIT License",
          "• i18next / react-i18next: MIT License",
          "• Zustand: MIT License",
          "• PapaParse: MIT License",
          "• date-fns: MIT License",
        ],
      },
      {
        heading: "Notices",
        body: [
          "The MIT, ISC, and Apache-2.0 licenses require preservation of their copyright and permission notices, which are retained in the respective packages under node_modules and in the distributed build.",
        ],
      },
    ],
  };

  return { terms, privacy, licenses };
}

export function LegalPage() {
  const { doc } = useParams<{ doc: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const docs = useMemo(() => buildDocs(), []);

  const current = doc ? docs[doc] : undefined;
  if (!current) return <Navigate to="/legal/terms" replace />;

  const Icon = current.icon;
  const tabs = [docs.terms, docs.privacy, docs.licenses];

  return (
    <div className="max-w-3xl w-full mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-[#122222]/60 dark:text-white/60 hover:text-emerald mb-5 cursor-pointer"
      >
        <ArrowLeft size={15} /> {t("common.back", "Back")}
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-11 h-11 rounded-xl bg-emerald/10 text-emerald dark:bg-emerald-light/10 dark:text-emerald-light flex items-center justify-center shrink-0">
          <Icon size={22} />
        </div>
        <div>
          <h1 className="font-display text-[26px] font-bold text-[#122222] dark:text-white leading-tight">{current.title}</h1>
          <p className="text-[13px] text-[#122222]/60 dark:text-white/60">{current.subtitle}</p>
        </div>
      </div>

      {/* Tabs between the three documents */}
      <div className="flex gap-1.5 border-b border-black/5 dark:border-white/5 mb-6 mt-4">
        {tabs.map((d) => (
          <button
            key={d.key}
            onClick={() => navigate(`/legal/${d.key}`)}
            className={`px-4 py-2 text-[13px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              d.key === current.key
                ? "border-emerald text-emerald dark:text-emerald-light"
                : "border-transparent text-[#122222]/50 dark:text-white/50 hover:text-[#122222] dark:hover:text-white"
            }`}
          >
            {d.title}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="bg-white dark:bg-[#1d2926] border border-black/5 dark:border-white/5 rounded-2xl shadow-card p-6 space-y-6">
        {current.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="font-bold text-[15px] text-[#122222] dark:text-white mb-2">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-[#122222]/75 dark:text-white/75 mb-1.5 whitespace-pre-line">{p}</p>
            ))}
          </section>
        ))}
        <p className="text-[11px] text-[#122222]/40 dark:text-white/40 pt-4 border-t border-black/5 dark:border-white/5">
          © {YEAR} Warraq, {OWNER}. Licensed free of charge to the {INSTITUTION} only.
        </p>
      </div>
    </div>
  );
}
