export const LIVE_MUTATION_EVENT = "sahara-santa:updated";
const INTERVAL = 3000;

export function isLiveUpdatePath(pathname: string): boolean {
  if (/^\/groups\/[^/]+\/reveal\/?$/.test(pathname)) return false;
  return pathname === "/" || /^\/(groups|join|profile)(\/|$)/.test(pathname);
}

/** Refresh changed server data without reloading the document or interrupting edits. */
export function connectLiveUpdates(pathname: string, refresh: () => void): () => void {
  let disposed = false;
  let version: string | null = null;
  let request: AbortController | null = null;
  const dirtyForms = new Set<Element>();
  const canRefresh = () => {
    for (const form of dirtyForms) if (!form.isConnected) dirtyForms.delete(form);
    return !disposed && document.visibilityState === "visible" && navigator.onLine !== false &&
      dirtyForms.size === 0 && !document.querySelector('dialog[open], [aria-modal="true"], fieldset:disabled, [data-picture-editor="active"]');
  };

  const check = async () => {
    if (request || !canRefresh()) return;
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`/api/live?path=${encodeURIComponent(pathname)}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      let next: unknown;
      if (response.ok) next = (await response.json()).version;
      else if (response.status === 401 || response.status === 404) next = `status:${response.status}`;
      else return;

      if (typeof next === "string" && next !== version && canRefresh()) {
        version = next;
        refresh();
      }
    } catch {
      // Network interruptions retry on the next tick, focus, or reconnect.
    } finally {
      clearTimeout(timeout);
      request = null;
    }
  };
  const retry = () => { void check(); };
  const edit = (event: Event) => {
    const form = (event.target as Element | null)?.closest("form");
    if (form) dirtyForms.add(form);
  };
  const reset = (event: Event) => {
    if (event.target instanceof Element) dirtyForms.delete(event.target);
  };
  const saved = (event: Event) => {
    const form = (event as CustomEvent<Element | null>).detail;
    if (form) dirtyForms.delete(form);
  };

  document.addEventListener("input", edit, true);
  document.addEventListener("change", edit, true);
  document.addEventListener("reset", reset, true);
  document.addEventListener("visibilitychange", retry);
  window.addEventListener("focus", retry);
  window.addEventListener("online", retry);
  window.addEventListener(LIVE_MUTATION_EVENT, saved);
  const timer = setInterval(retry, INTERVAL);
  retry();

  return () => {
    disposed = true;
    clearInterval(timer);
    request?.abort();
    document.removeEventListener("input", edit, true);
    document.removeEventListener("change", edit, true);
    document.removeEventListener("reset", reset, true);
    document.removeEventListener("visibilitychange", retry);
    window.removeEventListener("focus", retry);
    window.removeEventListener("online", retry);
    window.removeEventListener(LIVE_MUTATION_EVENT, saved);
  };
}
