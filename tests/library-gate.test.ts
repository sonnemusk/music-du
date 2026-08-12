import { describe, expect, it } from "vitest";
import { libraryGate } from "../server/site-mode.js";

describe("libraryGate Q-2", () => {
  it("allows GET without token when not required", () => {
    expect(libraryGate({ method: "GET" }).ok).toBe(true);
  });

  it("forbids writes when readonly", () => {
    const g = libraryGate({ method: "PUT", readonly: true });
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.status).toBe(403);
  });

  it("allows GET when readonly", () => {
    expect(libraryGate({ method: "GET", readonly: true }).ok).toBe(true);
  });

  it("requires matching token when configured", () => {
    const g = libraryGate({
      method: "GET",
      expectedToken: "secret",
      tokenHeader: "wrong",
    });
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.status).toBe(401);
    expect(
      libraryGate({ method: "GET", expectedToken: "secret", tokenHeader: "secret" }).ok
    ).toBe(true);
  });

  it("accepts Bearer Authorization", () => {
    expect(
      libraryGate({
        method: "PUT",
        expectedToken: "tok",
        authHeader: "Bearer tok",
      }).ok
    ).toBe(true);
  });
});
