import { describe, expect, it } from "vitest";
import { isValidIsbn, normalizeIsbn } from "./isbn";

describe("ISBN utilities", () => {
  it("normalizes separators and validates ISBN-13", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(isValidIsbn("978-0-306-40615-7")).toBe(true);
  });
  it("validates ISBN-10 including X check digits", () => {
    expect(isValidIsbn("0-8044-2957-X")).toBe(true);
    expect(isValidIsbn("9780306406158")).toBe(false);
  });
});
