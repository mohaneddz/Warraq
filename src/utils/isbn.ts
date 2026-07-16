export function normalizeIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export function isValidIsbn(value: string) {
  const isbn = normalizeIsbn(value);
  if (isbn.length === 10) {
    return isbn.split("").reduce((sum, digit, index) => sum + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0) % 11 === 0;
  }
  if (isbn.length === 13 && /^\d{13}$/.test(isbn)) {
    return isbn.split("").reduce((sum, digit, index) => sum + Number(digit) * (index % 2 ? 3 : 1), 0) % 10 === 0;
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
