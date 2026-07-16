import { addDays, differenceInCalendarDays, format } from "date-fns";

export const today = () => format(new Date(), "yyyy-MM-dd");
export const dueDate = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");
export const daysLate = (due: string) => Math.max(0, differenceInCalendarDays(new Date(), new Date(`${due}T00:00:00`)));

export const formatDisplayDate = (dateInput: string | Date | null | undefined): string => {
  if (!dateInput) return "";
  let date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime()) && typeof dateInput === "string") {
    date = new Date(`${dateInput}T00:00:00`);
  }
  if (isNaN(date.getTime())) return "";

  let formatStr = "dd/MM/yyyy";
  let tz = "Africa/Algiers";
  let locale = "en";
  try {
    const stored = localStorage.getItem("warraq-preferences");
    if (stored) {
      const prefs = JSON.parse(stored);
      if (prefs.dateFormat) formatStr = prefs.dateFormat;
      if (prefs.timezone) tz = prefs.timezone;
      if (prefs.locale) locale = prefs.locale;
    }
  } catch {}

  try {
    const formatter = new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-FR" : "en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
    const parts = formatter.formatToParts(date);
    const partMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
    
    const localDateInTz = new Date(
      Number(partMap.year),
      Number(partMap.month) - 1,
      Number(partMap.day),
      Number(partMap.hour || 0),
      Number(partMap.minute || 0),
      Number(partMap.second || 0)
    );
    
    let token = "dd/MM/yyyy";
    if (formatStr === "MM/dd/yyyy") token = "MM/dd/yyyy";
    if (formatStr === "yyyy-MM-dd") token = "yyyy-MM-dd";
    
    return format(localDateInTz, token);
  } catch (e) {
    let token = "dd/MM/yyyy";
    if (formatStr === "MM/dd/yyyy") token = "MM/dd/yyyy";
    if (formatStr === "yyyy-MM-dd") token = "yyyy-MM-dd";
    return format(date, token);
  }
};

