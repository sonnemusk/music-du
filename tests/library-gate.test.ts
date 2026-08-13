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

  it("allows writes without an app token", () => {
    expect(libraryGate({ method: "PUT" }).ok).toBe(true);
    expect(libraryGate({ method: "DELETE" }).ok).toBe(true);
  });
});
