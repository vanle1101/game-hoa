/** Errors safe to expose as an HTTP status and a short user-facing message. */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}
