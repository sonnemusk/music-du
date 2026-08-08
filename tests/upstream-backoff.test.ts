import { afterEach, describe, expect, it } from "vitest";
import {
  isUpstreamBlocked,
  noteUpstreamError,
  noteUpstreamOk,
  upstreamBlockedMs,
} from "../client/src/lib/upstream-backoff.js";

afterEach(() => {
  noteUpstreamOk();
});

describe("upstream backoff", () => {
  it("starts unblocked", () => {
    expect(isUpstreamBlocked()).toBe(false);
    expect(upstreamBlockedMs()).toBe(0);
  });

  it("blocks after 429", () => {
    noteUpstreamError(429);
    expect(isUpstreamBlocked()).toBe(true);
    expect(upstreamBlockedMs()).toBeGreaterThan(0);
  });

  it("ignores 4xx other than 429", () => {
    noteUpstreamError(404);
    expect(isUpstreamBlocked()).toBe(false);
  });

  it("clears on ok", () => {
    noteUpstreamError(429);
    noteUpstreamOk();
    expect(isUpstreamBlocked()).toBe(false);
  });
});
