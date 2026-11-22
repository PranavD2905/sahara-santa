import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectLiveUpdates, isLiveUpdatePath, LIVE_MUTATION_EVENT } from "./live-updates";

let cleanup: (() => void) | undefined;
let version = "a";
let doc: EventTarget & { visibilityState: string; querySelector: ReturnType<typeof vi.fn> };
const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => Response.json({ version }));

beforeEach(() => {
  vi.useFakeTimers();
  version = "a";
  doc = Object.assign(new EventTarget(), { visibilityState: "visible", querySelector: vi.fn(() => null) });
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("navigator", { onLine: true });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset().mockImplementation(async () => Response.json({ version }));
});

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("live updates", () => {
  it("updates cached arrivals, then only refreshes when server data changes", async () => {
    const refresh = vi.fn();
    cleanup = connectLiveUpdates("/groups/g1", refresh);
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(1);
    version = "b";
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("waits while a tab is hidden and checks immediately on return", async () => {
    doc.visibilityState = "hidden";
    const refresh = vi.fn();
    cleanup = connectLiveUpdates("/", refresh);
    await vi.advanceTimersByTimeAsync(6000);
    expect(fetchMock).not.toHaveBeenCalled();
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("preserves unsaved forms and resumes after the specific form is saved", async () => {
    const refresh = vi.fn();
    cleanup = connectLiveUpdates("/profile", refresh);
    await vi.advanceTimersByTimeAsync(0);
    const form = { isConnected: true };
    const input = new Event("input");
    Object.defineProperty(input, "target", { value: { closest: () => form } });
    doc.dispatchEvent(input);
    version = "b";
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(1);
    const saved = new Event(LIVE_MUTATION_EVENT);
    Object.defineProperty(saved, "detail", { value: form });
    window.dispatchEvent(saved);
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("does not apply an in-flight response if editing starts before it arrives", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => { resolve = r; }));
    const refresh = vi.fn();
    cleanup = connectLiveUpdates("/profile", refresh);
    const input = new Event("input");
    Object.defineProperty(input, "target", { value: { closest: () => ({ isConnected: true }) } });
    doc.dispatchEvent(input);
    resolve(Response.json({ version: "b" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("waits while a confirmation or submission is active", async () => {
    doc.querySelector.mockReturnValue({});
    const refresh = vi.fn();
    cleanup = connectLiveUpdates("/groups/g1/settings", refresh);
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).not.toHaveBeenCalled();
    doc.querySelector.mockReturnValue(null);
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("retries transient network failures instead of stopping updates", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    const refresh = vi.fn();
    cleanup = connectLiveUpdates("/", refresh);
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes once when access is revoked", async () => {
    const refresh = vi.fn();
    cleanup = connectLiveUpdates("/groups/g1", refresh);
    await vi.advanceTimersByTimeAsync(0);
    fetchMock.mockImplementation(async () => new Response(null, { status: 404 }));
    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("aborts pending requests and does not refresh after leaving the page", async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((r) => { resolve = r; }));
    const refresh = vi.fn();
    cleanup = connectLiveUpdates("/", refresh);
    const signal = fetchMock.mock.calls[0][1]?.signal;
    cleanup();
    expect(signal?.aborted).toBe(true);
    resolve(Response.json({ version: "a" }));
    await vi.advanceTimersByTimeAsync(6000);
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves Reveal animations and authentication screens undisturbed", () => {
    for (const path of ["/groups/g1/reveal", "/sign-in", "/sign-up"]) expect(isLiveUpdatePath(path)).toBe(false);
    for (const path of ["/", "/groups/g1", "/groups/g1/settings", "/profile", "/join/CODE"]) {
      expect(isLiveUpdatePath(path)).toBe(true);
    }
  });
});
