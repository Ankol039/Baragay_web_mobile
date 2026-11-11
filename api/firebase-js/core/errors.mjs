export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'HttpError'; this.status = status }
}
export function fail(message, status = 400) { throw new HttpError(message, status) }
export function assert(condition, message, status = 400) { if (!condition) fail(message, status) }
