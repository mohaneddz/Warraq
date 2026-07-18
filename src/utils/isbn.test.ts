import { describe, expect, it } from "vitest";
import { isValidIsbn, normalizeIsbn, formatIsbn } from "./isbn";

describe("ISBN utilities", () => {
  it("normalizes separators and validates ISBN-13", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(isValidIsbn("978-0-306-40615-7")).toBe(true);
  });
  it("validates ISBN-10 including X check digits", () => {
    expect(isValidIsbn("0-8044-2957-X")).toBe(true);
    expect(isValidIsbn("9780306406158")).toBe(true);
    expect(isValidIsbn("978030640615")).toBe(false);
  });
  it("formats ISBN-10 and ISBN-13 correctly with hyphens", () => {
    expect(formatIsbn("0306406152")).toBe("0-306-40615-2");
    expect(formatIsbn("9780306406157")).toBe("978-0-306-40615-7");
    expect(formatIsbn("9788175257665")).toBe("978-81-7525-766-5"); // 2-digit group identifier (India)
    expect(formatIsbn("978-0-306-40615-7")).toBe("978-0-306-40615-7"); // Already formatted
    expect(formatIsbn("invalid")).toBe("invalid"); // Fallback
    expect(formatIsbn("")).toBe(""); // Empty input
  });
});
