export class HttpError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

export function validateBody(errors) {
  if (Object.keys(errors).length) throw new HttpError(400, Object.values(errors)[0], errors);
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Please send valid JSON.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'Request is too large.' });
  if (error.status && error.status < 500) {
    return res.status(error.status).json({ message: error.message, ...(error.errors && { errors: error.errors }) });
  }
  console.error('Request failed:', error.message);
  res.status(500).json({ message: 'Something went wrong. Please try again.' });
}
