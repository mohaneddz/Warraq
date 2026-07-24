import React, { useState } from "react";
import { Modal, Input, Button } from "../ui/primitives";
import { useUiStore } from "../../store/uiStore";
import { Trash2, CheckCircle2, UserPlus } from "lucide-react";

import { ImageUpload } from "../ui/ImageUpload";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function UserSelectionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useUiStore();
  const [isCreating, setIsCreating] = useState(false);

  // Form states for creating profile
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OperatorProfile["role"]>("Head Librarian");
  const [avatar, setAvatar] = useState<string | null>(null);

  // Stored operators
  const storedOperatorsJson = typeof localStorage === "undefined" ? null : localStorage.getItem("warraq-operators");
  const defaultOperators: OperatorProfile[] = [
    {
      id: "op-default-1",
      name: preferences.operatorName || "Chief Librarian",
      role: "Head Librarian",
      email: preferences.operatorEmail || "head@warraq.library",
      avatar_path: preferences.operatorAvatar || null,
      created_at: new Date().toISOString(),
    },
    {
      id: "op-default-2",
      name: "Samir KHALED",
      role: "Assistant Librarian",
      email: "samir.khaled@warraq.library",
      avatar_path: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "op-default-3",
      name: "Amel BOURAS",
      role: "Cataloger",
      email: "amel.bouras@warraq.library",
      avatar_path: null,
      created_at: new Date().toISOString(),
    },
  ];

  const [operators, setOperators] = useState<OperatorProfile[]>(() => {
    if (storedOperatorsJson) {
      try {
        return JSON.parse(storedOperatorsJson);
      } catch {
        return defaultOperators;
      }
    }
    return defaultOperators;
  });

  const saveOperatorsToStorage = (updated: OperatorProfile[]) => {
    setOperators(updated);
    localStorage.setItem("warraq-operators", JSON.stringify(updated));
  };

  const handleSelectOperator = (op: OperatorProfile) => {
    updatePreferences({
      operatorName: op.name,
      operatorEmail: op.email || "",
      operatorAvatar: op.avatar_path || null,
    });
    toast.success(t("users.switchedUser", { name: op.name }) || `Switched active operator to ${op.name}`);
    onClose();
  };

  const handleCreateOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("users.nameRequired") || "Please enter operator name.");
      return;
    }

    const newOp: OperatorProfile = {
      id: `op-${Date.now()}`,
      name: name.trim(),
      role,
      email: email.trim() || null,
      avatar_path: avatar,
      created_at: new Date().toISOString(),
    };

    const updated = [newOp, ...operators];
    saveOperatorsToStorage(updated);
    handleSelectOperator(newOp);
    setIsCreating(false);
    setName("");
    setEmail("");
    setAvatar(null);
  };

  const handleDeleteOperator = (opId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (operators.length <= 1) {
      toast.warning(t("users.atLeastOne") || "You must keep at least one operator profile.");
      return;
    }
    const updated = operators.filter((o) => o.id !== opId);
    saveOperatorsToStorage(updated);
    toast.info(t("users.operatorDeleted") || "Operator profile removed.");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isCreating ? (t("users.createProfile") || "Create New Operator Profile") : (t("users.selectProfile") || "Switch Active Operator Profile")}>
      {!isCreating ? (
        <div className="space-y-4 text-sans">
          <p className="text-[12px] text-[#122222]/60 dark:text-white/60">
            {t("users.selectSubtitle") || "Select a local librarian profile to switch session operator:"}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-1">
            {operators.map((op) => {
              const isActive = (preferences.operatorName || "").toLowerCase() === op.name.toLowerCase();
              const initials = op.name.substring(0, 2).toUpperCase();

              return (
                <div
                  key={op.id}
                  onClick={() => handleSelectOperator(op)}
                  className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center gap-3.5 select-none ${
                    isActive
                      ? "bg-emerald/5 dark:bg-emerald-light/10 border-emerald ring-2 ring-emerald/30 shadow-md"
                      : "bg-white dark:bg-[#1d2926] border-black/8 dark:border-white/8 hover:border-emerald/40 hover:shadow-card"
                  }`}
                >
                  <div className="relative w-11 h-11 rounded-full border-2 border-white dark:border-[#1d2926] shadow-sm overflow-hidden bg-emerald text-white flex items-center justify-center shrink-0">
                    {op.avatar_path ? (
                      <img src={op.avatar_path} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display font-bold text-[13px]">{initials}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[13px] text-[#122222] dark:text-white truncate">{op.name}</span>
                      {isActive && <CheckCircle2 size={14} className="text-emerald dark:text-emerald-light shrink-0" />}
                    </div>
                    <div className="text-[10px] font-bold text-[#b96f3e] uppercase tracking-wider mt-0.5">{op.role}</div>
                    {op.email && (
                      <div className="text-[11px] text-[#122222]/50 dark:text-white/50 truncate mt-0.5">{op.email}</div>
                    )}
                  </div>

                  {!isActive && operators.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteOperator(op.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-[#122222]/40 hover:text-red-500 p-1.5 rounded-lg transition-all cursor-pointer"
                      title="Delete profile"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-black/5 dark:border-white/5 flex justify-between items-center">
            <Button variant="secondary" onClick={() => setIsCreating(true)} className="flex items-center gap-1.5 text-xs">
              <UserPlus size={14} /> {t("users.addProfile") || "Add New Profile"}
            </Button>
            <Button variant="ghost" onClick={onClose}>
              {t("catalog.addModal.cancel") || "Close"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateOperator} className="space-y-4 text-xs">
          <div className="flex justify-center py-2">
            <ImageUpload value={avatar} onChange={setAvatar} shape="circle" label={t("users.avatarLabel") || "Profile Avatar"} />
          </div>

          <label className="block text-[11px] font-semibold text-[#122222]/70 dark:text-white/70">
            <span>{t("members.firstName") || "Full Name"} <span className="text-red-500">*</span></span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dr. Meriem BENALI" className="mt-1" />
          </label>

          <label className="block text-[11px] font-semibold text-[#122222]/70 dark:text-white/70">
            <span>{t("members.roleLabel") || "Library Role"}</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 dark:border-white/10 rounded-lg outline-none"
            >
              <option value="Head Librarian">{t("roles.headLibrarian") || "Head Librarian"}</option>
              <option value="Assistant Librarian">{t("roles.assistantLibrarian") || "Assistant Librarian"}</option>
              <option value="Administrator">{t("roles.administrator") || "Administrator"}</option>
              <option value="Cataloger">{t("roles.cataloger") || "Cataloger"}</option>
              <option value="Staff">{t("members.roles.staff") || "Staff"}</option>
            </select>
          </label>

          <label className="block text-[11px] font-semibold text-[#122222]/70 dark:text-white/70">
            <span>{t("members.email") || "Email Address"}</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operator@warraq.library" className="mt-1" />
          </label>

          <div className="pt-4 border-t border-black/5 dark:border-white/5 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>
              {t("catalog.addModal.cancel") || "Back"}
            </Button>
            <Button type="submit">
              {t("users.saveAndSwitch") || "Create & Switch"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
