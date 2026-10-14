// A friendly error with an HTTP status. Thrown anywhere, turned into JSON by the error handler.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code, message, details) => new AppError(400, code, message, details);
export const unauthorized = (message = 'Please log in.') => new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'You do not have access to this.') => new AppError(403, 'forbidden', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'not_found', message);
export const conflict = (code, message) => new AppError(409, code, message);
