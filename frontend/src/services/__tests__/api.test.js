import { describe, it, expect, beforeEach, afterEach } from "vitest";
import api, { handleApiError } from "../api";

// Capture the outgoing request instead of hitting the network
function captureAdapter(store) {
  return async (config) => {
    store.config = config;
    return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
  };
}

describe("api request interceptor", () => {
  const originalAdapter = api.defaults.adapter;

  beforeEach(() => {
    globalThis.window = globalThis.window || {};
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
    delete globalThis.window.Clerk;
  });

  it("awaits the async Clerk token and sends it as a Bearer header", async () => {
    globalThis.window.Clerk = { session: { getToken: () => Promise.resolve("jwt-123") } };
    const store = {};
    api.defaults.adapter = captureAdapter(store);

    await api.get("/api/products");

    expect(store.config.headers.Authorization).toBe("Bearer jwt-123");
  });

  it("sends no Authorization header when there is no Clerk session", async () => {
    const store = {};
    api.defaults.adapter = captureAdapter(store);

    await api.get("/api/health");

    expect(store.config.headers.Authorization).toBeUndefined();
  });

  it("uses the configured backend base URL", () => {
    expect(api.defaults.baseURL).toMatch(/^https?:\/\//);
  });
});

describe("handleApiError", () => {
  it("returns the server's message field", () => {
    const err = { response: { status: 409, data: { message: "Insufficient stock for Paracip: requested 80, available 70" } } };
    expect(handleApiError(err).message).toBe("Insufficient stock for Paracip: requested 80, available 70");
  });

  it("explains an unreachable server", () => {
    expect(handleApiError({ request: {} }).message).toMatch(/Cannot reach the server/);
  });

  it("falls back to the HTTP status when there is no body", () => {
    expect(handleApiError({ response: { status: 500, data: null } }).message).toBe("Request failed (500)");
  });

  it("explains 401 responses", () => {
    const err = { message: "Your session has expired or is not authorised. Please sign in again.", response: { status: 401, data: "" } };
    expect(handleApiError(err).message).toMatch(/session has expired/);
  });
});
