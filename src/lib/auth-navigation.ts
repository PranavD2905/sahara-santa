/** Read the new session from the server instead of racing a route change with refresh(). */
export function navigateAfterAuthentication(next: string): void {
  const destination = new URL(next, window.location.origin);
  const href = destination.origin === window.location.origin ? destination.href : "/";
  window.location.replace(href);
}
