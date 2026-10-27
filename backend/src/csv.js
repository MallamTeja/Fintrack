// CSV import fingerprinting and CSV export helpers (pure functions, no I/O).
const crypto = require('crypto');
const { validateImportRow } = require('./validate');

/** Lowercase, collapse runs of whitespace and trim. */
const normalizeDescription = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Fingerprint of an imported row: sha256 hex of
 * `YYYY-MM-DD|type|amount with 2 decimals|payee_key or normalized description`.
 * Computed on validated values only; a client supplied hash is never trusted.
 */
function importHash({ date, type, amount, description, payee_key: payeeKey }) {
    const day = new Date(date).toISOString().slice(0, 10);
    // Rows linked to a payee are fingerprinted by payee, so renaming a payee never breaks duplicate checks.
    const who = payeeKey || normalizeDescription(description);
    const key = `${day}|${type}|${Number(amount).toFixed(2)}|${who}`;
    return crypto.createHash('sha256').update(key, 'utf8').digest('hex');
}

/**
 * Validates every row, fingerprints the valid ones and drops repeats inside the batch.
 * Returns { rows (ready to insert), invalid: [{ index, errors }], duplicates }.
 */
function prepareImport(rawRows) {
    const rows = [];
    const invalid = [];
    const seen = new Set();
    let duplicates = 0;
    rawRows.forEach((raw, index) => {
        const { value, errors } = validateImportRow(raw);
        if (errors) {
            invalid.push({ index, errors });
            return;
        }
        const import_hash = importHash(value);
        if (seen.has(import_hash)) {
            duplicates += 1;
            return;
        }
        seen.add(import_hash);
        // Every row gets the same keys: a bulk insert must not turn a missing key into NULL.
        rows.push({ description: '', notes: '', payment_method: 'other', payee_key: null, ...value, source: 'import', import_hash });
    });
    return { rows, invalid, duplicates };
}

/** One CSV cell: neutralises spreadsheet formulas, then applies RFC 4180 quoting. */
function csvCell(value) {
    let s = value === null || value === undefined ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const EXPORT_COLUMNS = ['date', 'type', 'category', 'description', 'amount', 'payment_method', 'notes', 'source'];

/** Transactions to CSV text (header row first, CRLF line endings). */
function toCsv(transactions) {
    const lines = [EXPORT_COLUMNS.join(',')];
    for (const t of transactions) {
        lines.push(
            [
                new Date(t.date).toISOString().slice(0, 10),
                t.type,
                t.category,
                t.description,
                Number(t.amount).toFixed(2),
                t.payment_method,
                t.notes,
                t.source,
            ]
                .map(csvCell)
                .join(',')
        );
    }
    return `${lines.join('\r\n')}\r\n`;
}

module.exports = { normalizeDescription, importHash, prepareImport, csvCell, toCsv, EXPORT_COLUMNS };
