import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Modal, Input, Button } from "./ui/primitives";
import { updateCopy } from "../data/repositories/library";
import { queryClient } from "../app/providers";
import type { Copy, Shelf } from "../types";
import { FLOOR_SHELF_CODE } from "../types";
import { cleanBarcode, cleanAccession } from "../utils/isbn";

const invalidate = () => queryClient.invalidateQueries();

/**
 * Edit a physical copy's identifiers, condition/status, and shelving location.
 * Location is picked in two steps — bookcase (room + column), then row within that
 * bookcase — mirroring the rooms→columns→shelves hierarchy the rest of the app uses,
 * rather than one flat list of every shelf in the library.
 */
export function CopyEditModal({ copy, onClose, shelves }: { copy: Copy & { title?: string }; onClose: () => void; shelves: Shelf[] }) {
  const { t } = useTranslation();
  const currentShelf = shelves.find(s => s.id === copy.shelf_id);

  const bookcases = useMemo(() => {
    const seen = new Map<string, { column_id: string; room?: string; column_number?: number }>();
    for (const s of shelves) {
      if (!seen.has(s.column_id)) seen.set(s.column_id, { column_id: s.column_id, room: s.room, column_number: s.column_number });
    }
    return Array.from(seen.values()).sort((a, b) => (a.room || "").localeCompare(b.room || "") || (a.column_number ?? 0) - (b.column_number ?? 0));
  }, [shelves]);

  const [bookcaseId, setBookcaseId] = useState(currentShelf?.column_id ?? "");
  const [shelfId, setShelfId] = useState(currentShelf?.id ?? "");

  const rowsInBookcase = useMemo(
    () => shelves.filter(s => s.column_id === bookcaseId),
    [shelves, bookcaseId]
  );

  const form = useForm({ defaultValues: { barcode: copy.barcode, accession_number: copy.accession_number, condition: copy.condition, status: copy.status } });

  const mutation = useMutation({
    mutationFn: (v: { barcode: string; accession_number: string; condition: string; status: string }) =>
      updateCopy(copy.id, {
        barcode: cleanBarcode(v.barcode),
        accession_number: cleanAccession(v.accession_number),
        condition: v.condition,
        status: v.status as Copy["status"],
        shelfId: shelfId || null,
      }),
    onSuccess: () => { toast.success(t("inventory.copyUpdated", "Copy updated.")); invalidate(); onClose(); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Modal isOpen={true} onClose={onClose} title={`${t("inventory.editCopy", "Edit Copy")}: ${copy.barcode}`}>
      <form onSubmit={form.handleSubmit(v => mutation.mutate(v))} className="space-y-4 text-[13px]">
        {copy.title && (
          <div><p className="text-[10px] text-[#122222]/40 uppercase tracking-wider font-semibold">{t("catalog.headers.title")}</p><p className="font-semibold mt-0.5">{copy.title}</p></div>
        )}
        <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("catalog.details.copyBarcode", "Barcode")}
          <Input {...form.register("barcode")} className="mt-1" />
        </label>
        <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("catalog.details.copyAccession", "Index")}
          <Input {...form.register("accession_number")} className="mt-1" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("inventory.bookcase", "Bookcase")}
            <select
              value={bookcaseId}
              onChange={e => { setBookcaseId(e.target.value); setShelfId(""); }}
              className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 rounded-lg outline-none"
            >
              <option value="">{t("catalog.details.shelfUnassigned", "Unassigned")}</option>
              {bookcases.map(b => (
                <option key={b.column_id} value={b.column_id}>{b.room} · {t("inventory.columnLabel", "Column {{number}}", { number: b.column_number })}</option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("inventory.row", "Row")}
            <select
              value={shelfId}
              onChange={e => setShelfId(e.target.value)}
              disabled={!bookcaseId}
              className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 rounded-lg outline-none disabled:opacity-40"
            >
              <option value="">{t("catalog.details.shelfUnassigned", "Unassigned")}</option>
              {rowsInBookcase.map(s => (
                <option key={s.id} value={s.id}>{s.shelf_type === "floor" ? `${FLOOR_SHELF_CODE} ${t("inventory.floorShelf", "Floor shelf")}` : t("inventory.shelfLetter", "Shelf {{code}}", { code: s.code })}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("catalog.details.copyCondition", "Condition")}
          <select {...form.register("condition")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 rounded-lg outline-none">
            {["mint", "good", "fair", "worn", "damaged"].map(v => <option key={v} value={v}>{t(`catalog.condition.${v}`, v.charAt(0).toUpperCase() + v.slice(1))}</option>)}
          </select>
        </label>
        <label className="text-[11px] font-semibold text-[#122222]/60 block">{t("inventory.status", "Status")}
          <select {...form.register("status")} className="field-select text-[13px] py-2 px-3 mt-1 font-semibold w-full bg-white dark:bg-[#1d2926] border border-black/10 rounded-lg outline-none">
            <option value="available">{t("reports.statusLabels.available", "Available")}</option><option value="on-loan">{t("reports.statusLabels.onloan", "On Loan")}</option><option value="reserved">{t("reports.statusLabels.reserved", "Reserved")}</option><option value="repair">{t("reports.statusLabels.repair", "In Repair")}</option><option value="lost">{t("reports.statusLabels.lost", "Lost")}</option>
          </select>
        </label>
        <div className="flex gap-2 justify-end pt-4 border-t border-black/5"><Button type="button" variant="ghost" onClick={onClose}>{t("cancel", "Cancel")}</Button><Button type="submit" disabled={mutation.isPending}>{t("inventory.saveChanges", "Save Changes")}</Button></div>
      </form>
    </Modal>
  );
}
