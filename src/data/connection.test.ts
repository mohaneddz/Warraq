import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { keyRole, projectRefFrom, projectUrlFrom, sqlEditorUrl } from "./connection";
import { buildSchema } from "../../scripts/build_schema.mjs";

const REF = "abcdefghijklmnopqrst";

describe("projectRefFrom", () => {
  it("accepts the bare reference, the API URL and dashboard links", () => {
    expect(projectRefFrom(REF)).toBe(REF);
    expect(projectRefFrom(`https://${REF}.supabase.co`)).toBe(REF);
    expect(projectRefFrom(`${REF}.supabase.co/rest/v1/`)).toBe(REF);
    expect(projectRefFrom(`https://supabase.com/dashboard/project/${REF}/settings/api`)).toBe(REF);
    expect(projectRefFrom(`  https://supabase.com/dashboard/project/${REF}  `)).toBe(REF);
  });

  it("rejects anything that is not a hosted Supabase project", () => {
    expect(projectRefFrom("")).toBeNull();
    expect(projectRefFrom("https://example.com")).toBeNull();
    expect(projectRefFrom("https://db.internal.lan")).toBeNull();
    expect(projectRefFrom("https://short.supabase.co")).toBeNull();
    expect(projectRefFrom("not a url at all")).toBeNull();
  });

  it("builds the canonical project URL and SQL editor link", () => {
    expect(projectUrlFrom(REF)).toBe(`https://${REF}.supabase.co`);
    expect(projectUrlFrom("nope")).toBeNull();
    expect(sqlEditorUrl(REF)).toBe(`https://supabase.com/dashboard/project/${REF}/sql/new`);
  });
});

describe("keyRole", () => {
  const jwt = (role: string) => `h.${btoa(JSON.stringify({ role })).replace(/=+$/, "")}.s`;

  it("tells publishable keys from secret ones", () => {
    expect(keyRole(jwt("anon"))).toBe("anon");
    expect(keyRole(jwt("service_role"))).toBe("service_role");
    expect(keyRole("sb_publishable_abc")).toBe("anon");
    expect(keyRole("sb_secret_abc")).toBe("service_role");
  });

  it("does not guess at anything else", () => {
    expect(keyRole("")).toBe("unknown");
    expect(keyRole("plain text")).toBe("unknown");
    expect(keyRole("a.%%%.c")).toBe("unknown");
    expect(keyRole(jwt("authenticated"))).toBe("unknown");
  });
});

describe("bundled schema", () => {
  it("is the current migrations joined in order, so new installs get every table", () => {
    const shipped = readFileSync(resolve("src/assets/schema.sql"), "utf8");
    expect(shipped, "run `node scripts/build_schema.mjs` after adding a migration").toBe(buildSchema().text);
  });

  it("covers every migration file", () => {
    const { files, text } = buildSchema();
    for (const name of files) expect(text).toContain(`-- ${name}`);
    expect(files.length).toBeGreaterThan(0);
  });
});
