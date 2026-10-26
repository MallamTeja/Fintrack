// Small HTTP helpers: typed errors, async route wrapper, error/404 handlers.

class HttpError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Turn a PostgREST / Postgres error into an HttpError with a safe message. */
function fromDbError(error, notFoundMessage = 'Not found') {
    if (!error) return null;
    switch (error.code) {
        case 'PGRST116': // .single() matched no row (or RLS hid it)
            return new HttpError(404, notFoundMessage);
        case '23505':
            return new HttpError(409, 'Already exists');
        case '23514': // check constraint
        case '22P02': // invalid input syntax
        case '22003': // numeric out of range
            return new HttpError(400, 'Invalid value');
        default:
            return new HttpError(500, 'Database error');
    }
}

function notFound(req, res) {
    res.status(404).json({ success: false, error: { message: 'The requested resource was not found' } });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (err.type === 'entity.parse.failed') err = new HttpError(400, 'Malformed JSON body');
    if (err.type === 'entity.too.large') err = new HttpError(413, 'Request body too large');
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error('[error]', req.method, req.originalUrl, err);
    res.status(status).json({
        success: false,
        error: {
            message: status >= 500 ? 'Something went wrong' : err.message,
            ...(err.details ? { details: err.details } : {}),
        },
    });
}

module.exports = { HttpError, asyncHandler, fromDbError, notFound, errorHandler };
