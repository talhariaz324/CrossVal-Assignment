export abstract class DomainError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;
  details?: Record<string, unknown>;

  constructor(message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

export class ValidationError extends DomainError {
  readonly httpStatus = 400;
  readonly code = "VALIDATION_ERROR";
}

export class UnauthenticatedError extends DomainError {
  readonly httpStatus = 401;
  readonly code = "UNAUTHENTICATED";
}

export class NotFoundError extends DomainError {
  readonly httpStatus = 404;
  readonly code = "NOT_FOUND";

  constructor(resource: string) {
    super(`${resource} not found`);
  }
}

export class EmailTakenError extends DomainError {
  readonly httpStatus = 409;
  readonly code = "EMAIL_TAKEN";

  constructor() {
    super("An account with this email already exists");
  }
}

export class OrderLockedError extends DomainError {
  readonly httpStatus = 409;
  readonly code = "ORDER_LOCKED";

  constructor() {
    super("This order has payments recorded and its line items/due date can no longer be edited");
  }
}

export class OverpaymentError extends DomainError {
  readonly httpStatus = 409;
  readonly code = "OVERPAYMENT";

  constructor(attemptedCents: number, maxAllowedCents: number) {
    super(
      `Payment of ${(attemptedCents / 100).toFixed(2)} exceeds the remaining balance of ${(maxAllowedCents / 100).toFixed(2)}`,
      { maxAllowedCents },
    );
  }
}

export class ServiceUnavailableError extends DomainError {
  readonly httpStatus = 503;
  readonly code = "SERVICE_UNAVAILABLE";

  constructor() {
    super("Temporarily unavailable — safe to retry");
  }
}
