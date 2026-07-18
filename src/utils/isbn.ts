export function normalizeIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function isValidIsbn(value: string) {
  const isbn = normalizeIsbn(value);
  if (isbn.length === 10) {
    return /^\d{9}[\dXx]$/.test(isbn);
  }
  if (isbn.length === 13) {
    return /^\d{13}$/.test(isbn);
  }
  return false;
}

export function cleanBarcode(value: string): string {
  return value.trim().toUpperCase();
}

export function cleanAccession(value: string): string {
  return value.trim().toUpperCase();
}

export function cleanPhone(value: string): string {
  const isPlusFirst = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  return isPlusFirst ? `+${digits}` : digits;
}

export function cleanMemberNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function cleanText(value: string): string {
  return value.trim();
}

export function formatIsbn(value: string | null | undefined): string {
  if (!value) return "";
  const clean = value.replace(/[^0-9Xx]/g, "");
  if (clean.length === 10) {
    // Format ISBN-10 as X-XXX-XXXXX-X (e.g., 0-306-40615-2)
    return clean.replace(/^(\d{1})(\d{3})(\d{5})([0-9Xx]{1})$/, "$1-$2-$3-$4");
  }
  if (clean.length === 13) {
    // Format ISBN-13 as 978-X-XXX-XXXXX-X or similar
    const groupDigit = clean.charAt(3);
    if (["0", "1", "2", "3", "4", "5", "7"].includes(groupDigit)) {
      return clean.replace(/^(\d{3})(\d{1})(\d{3})(\d{5})(\d{1})$/, "$1-$2-$3-$4-$5");
    } else {
      return clean.replace(/^(\d{3})(\d{2})(\d{4})(\d{3})(\d{1})$/, "$1-$2-$3-$4-$5");
    }
  }
  return value;
}
