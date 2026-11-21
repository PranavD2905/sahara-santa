export type DomainErrorCode =
  | "not-found"
  | "forbidden"
  | "unverified"
  | "invalid"
  | "conflict"
  | "limit";

/** An expected, user-facing failure. The message is safe to show. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const isDomainError = (e: unknown): e is DomainError =>
  e instanceof DomainError;
