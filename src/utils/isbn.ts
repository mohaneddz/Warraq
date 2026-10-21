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

/** Stricter than isValidIsbn: also verifies the check digit, which catches made-up ISBNs
 * (e.g. ones an LLM invents) that merely have the right length. */
export function hasValidIsbnChecksum(value: string) {
  const isbn = normalizeIsbn(value);
  if (!isValidIsbn(isbn)) return false;
  if (isbn.length === 10) {
    let sum = 0;
    for (let i = 0; i < 10; i++) {
      const digit = isbn[i] === "X" ? 10 : Number(isbn[i]);
      if (digit === 10 && i !== 9) return false;
      sum += digit * (10 - i);
    }
    return sum % 11 === 0;
  }
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return sum % 10 === 0;
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
  const digits = value.replace(/\D/g, "");
  return digits || value.trim();
}

export function formatMemberNumber(value: string | number | null | undefined): string {
  if (!value) return "";
  const str = String(value).trim();
  const digits = str.replace(/\D/g, "");
  if (!digits) return str;
  return `MB-${digits}`;
}

export function generateRandomMemberNumber(digitsCount = 6): string {
  const min = Math.pow(10, digitsCount - 1);
  const max = Math.pow(10, digitsCount) - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

export function cleanText(value: string): string {
  return value.trim();
}

export function cleanLastName(value: string): string {
  return value.trim().toUpperCase();
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
