import { describe, expect, it } from "vitest";
import { parseSquareJson } from "@/lib/square/client";

describe("parseSquareJson", () => {
  it("escapes raw control characters inside provider strings", () => {
    const parsed = parseSquareJson<{ description: string }>(
      '{"description":"first line\nsecond\tline\u0001"}',
    );

    expect(parsed.description).toBe("first line\nsecond\tline\u0001");
  });

  it("preserves valid formatting whitespace outside strings", () => {
    expect(parseSquareJson<{ ok: boolean }>(' {\n  "ok": true\n} ')).toEqual({ ok: true });
  });
});
