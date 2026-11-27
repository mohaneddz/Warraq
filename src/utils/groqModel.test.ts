import { afterEach, describe, expect, it, vi } from "vitest";
import { GROQ_MODEL, enrichMetadataWithGroq, resolveGroqModel } from "./metadata";

describe("resolveGroqModel", () => {
  it("falls back to the built-in default when the setting is blank", () => {
    expect(resolveGroqModel()).toBe(GROQ_MODEL);
    expect(resolveGroqModel("")).toBe(GROQ_MODEL);
    expect(resolveGroqModel("   ")).toBe(GROQ_MODEL);
  });

  it("uses a pasted model name, trimmed", () => {
    expect(resolveGroqModel("  llama-3.3-70b-versatile ")).toBe("llama-3.3-70b-versatile");
  });
});

describe("enrichMetadataWithGroq model choice", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubGroq = () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ title: "Dune" }) } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };
  const sentBody = (fetchMock: ReturnType<typeof stubGroq>) => JSON.parse(fetchMock.mock.calls[0][1].body);

  it("sends the default model and reasoning_effort when no override is set", async () => {
    const fetchMock = stubGroq();
    await enrichMetadataWithGroq("Dune", {}, "gsk_test");
    const body = sentBody(fetchMock);
    expect(body.model).toBe(GROQ_MODEL);
    expect(body.reasoning_effort).toBe("low");
  });

  it("sends the pasted model and omits reasoning_effort for non gpt-oss models", async () => {
    const fetchMock = stubGroq();
    await enrichMetadataWithGroq("Dune", {}, "gsk_test", "llama-3.3-70b-versatile");
    const body = sentBody(fetchMock);
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect("reasoning_effort" in body).toBe(false);
  });
});
