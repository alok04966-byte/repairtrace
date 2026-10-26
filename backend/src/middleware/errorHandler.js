function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found.' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'An unexpected error occurred.' });
}

module.exports = { errorHandler, notFoundHandler };
