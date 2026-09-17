export class DraftStateValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DraftStateValidationError';
  }
}

export class DraftStateConflictError extends Error {
  constructor(message, currentState = null) {
    super(message);
    this.name = 'DraftStateConflictError';
    this.currentState = currentState;
  }
}
