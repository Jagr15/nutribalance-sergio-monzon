export class ArcaError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(message: string, code = 'ARCA_ERROR', details?: unknown) {
    super(message);
    this.name = 'ArcaError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
