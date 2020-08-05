// Define all errors in API returns

export class ValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class BackendError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BackendError'
  }
}
