import { addDays, differenceInCalendarDays, format } from "date-fns";

export const today = () => format(new Date(), "yyyy-MM-dd");
export const dueDate = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");
export const daysLate = (due: string) => Math.max(0, differenceInCalendarDays(new Date(), new Date(`${due}T00:00:00`)));
