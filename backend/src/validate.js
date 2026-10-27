// Input validation. Each parser returns a clean object with only allowed fields
// (unknown fields are dropped silently) or throws HttpError(400) listing every problem.
const { HttpError } = require('./http');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Letters (any script, with combining marks), digits, spaces and & - / . , ' ( )
const CATEGORY_RE = /^[\p{L}\p{M}\p{N} &\-/.,'()]+$/u;
// Letters (any script), spaces and . ' -
const NAME_RE = /^[\p{L}\p{M} .'-]+$/u;
// YYYY-MM-DD with an optional time and offset.
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
const AMOUNT_STRING_RE = /^-?\d+(?:\.\d+)?$/;
// C0 controls, DEL and C1 controls. Multi-line fields keep \n.
const CONTROL_RE = /[\u0000-\u001F\u007F-\u009F]/g;
const CONTROL_KEEP_NL_RE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;

const MAX_AMOUNT = 1_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DATE_MS = Date.UTC(1970, 0, 1);

const TRANSACTION_TYPES = ['income', 'expense'];
const PAYMENT_METHODS = ['upi', 'card', 'cash', 'bank', 'wallet', 'other'];
const SOURCES = ['manual', 'import'];
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'AUD', 'CAD', 'JPY'];
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const WEEK_STARTS = ['monday', 'sunday'];
const THEMES = ['light', 'dark'];

// 'upi:<handle>' or 'name:<lowercased name>'; see supabase/migrations/20261027000000_payees.sql.
const PAYEE_KEY_RE = /^(upi|name):[\p{Ll}\p{Lo}\p{M}\p{N} ._@&'-]+$/u;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

/** Remove control characters; `multiline` keeps line breaks (CRLF and CR become LF). */
function stripControl(s, multiline = false) {
    if (multiline) return s.replace(/\r\n?/g, '\n').replace(CONTROL_KEEP_NL_RE, '');
    return s.replace(CONTROL_RE, '');
}

function text(v, field, { min = 1, max = 100, multiline = false, pattern, patternMessage, errors }) {
    if (typeof v !== 'string') {
        errors.push(`${field} must be text`);
        return undefined;
    }
    const s = stripControl(v, multiline).trim();
    if (s.length < min || s.length > max) {
        errors.push(min === 0 ? `${field} must be at most ${max} characters` : `${field} must be ${min}-${max} characters`);
    } else if (pattern && s && !pattern.test(s)) {
        errors.push(patternMessage);
    }
    return s;
}

const category = (v, field, errors) =>
    text(v, field, {
        max: 50,
        pattern: CATEGORY_RE,
        patternMessage: `${field} may only contain letters, numbers, spaces and & - / . , ' ( )`,
        errors,
    });

const personName = (v, field, errors) =>
    text(v, field, {
        max: 60,
        pattern: NAME_RE,
        patternMessage: `${field} may only contain letters, spaces and . ' -`,
        errors,
    });

/** Positive (or, with allowZero, non-negative) amount up to 1,000,000,000 with at most 2 decimals. */
function money(v, field, { allowZero = false, errors }) {
    let n = v;
    if (typeof v === 'string') {
        const s = v.trim();
        n = AMOUNT_STRING_RE.test(s) ? Number(s) : NaN;
    }
    if (typeof n !== 'number' || !Number.isFinite(n)) {
        errors.push(`${field} must be a number`);
        return undefined;
    }
    if (allowZero ? n < 0 : n <= 0) {
        errors.push(`${field} must be ${allowZero ? 'zero or more' : 'greater than 0'}`);
    } else if (n > MAX_AMOUNT) {
        errors.push(`${field} must be at most 1,000,000,000`);
    } else if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) {
        errors.push(`${field} must have at most 2 decimal places`);
    }
    return Math.round(n * 100) / 100;
}

/**
 * Strict ISO 8601 date or date-time. Returns a Date or null.
 * Rejects impossible calendar dates such as 2026-02-30.
 */
function parseIsoDate(v) {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    const m = ISO_DATE_RE.exec(s);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const calendar = new Date(Date.UTC(y, mo - 1, d));
    if (calendar.getUTCFullYear() !== y || calendar.getUTCMonth() !== mo - 1 || calendar.getUTCDate() !== d) return null;
    const [h, mi, sec] = [Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0)];
    if (h > 23 || mi > 59 || sec > 59) return null;
    const frac = /\.(\d{1,3})/.exec(s.slice(10));
    const ms = frac ? Number(frac[1].padEnd(3, '0')) : 0;
    // Date-only strings and date-times without an offset are read as UTC.
    let offsetMin = 0;
    if (m[7] && m[7] !== 'Z') {
        const sign = m[7][0] === '-' ? -1 : 1;
        const digits = m[7].slice(1).replace(':', '');
        const [oh, om] = [Number(digits.slice(0, 2)), Number(digits.slice(2, 4))];
        if (oh > 23 || om > 59) return null;
        offsetMin = sign * (oh * 60 + om);
    }
    const out = new Date(Date.UTC(y, mo - 1, d, h, mi, sec, ms) - offsetMin * 60 * 1000);
    return Number.isNaN(out.getTime()) ? null : out;
}
const isDateOnly = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());

/** Transaction date: ISO, not before 1970-01-01 and at most 1 day in the future. */
function transactionDate(v, field, errors) {
    const d = parseIsoDate(v);
    if (!d) {
        errors.push(`${field} must be a valid ISO date (YYYY-MM-DD)`);
        return undefined;
    }
    if (d.getTime() < MIN_DATE_MS) errors.push(`${field} cannot be before 1970-01-01`);
    else if (d.getTime() > Date.now() + DAY_MS) errors.push(`${field} cannot be more than 1 day in the future`);
    return d.toISOString();
}

function payeeKey(v, field, errors) {
    if (typeof v !== 'string' || v.length < 5 || v.length > 120 || !PAYEE_KEY_RE.test(v)) {
        errors.push(`${field} must look like upi:<handle> or name:<lowercase name>, 5-120 characters`);
        return undefined;
    }
    return v;
}

/** Body for PUT /api/payees: { key, name }. */
function parsePayee(body) {
    if (!isObject(body)) throw new HttpError(400, 'Expected a JSON object');
    const errors = [];
    const key = body.key === undefined ? (errors.push('key is required'), undefined) : payeeKey(body.key, 'key', errors);
    const name = body.name === undefined ? (errors.push('name is required'), undefined) : text(body.name, 'name', { max: 100, errors });
    return finish(errors, { key, name });
}

/** A payee key from a query string or body, for lookups and deletes. */
function parsePayeeKey(v) {
    const errors = [];
    const key = v === undefined ? (errors.push('key is required'), undefined) : payeeKey(v, 'key', errors);
    return finish(errors, key);
}

const oneOf = (allowed, message) => (v, field, errors) => {
    if (typeof v !== 'string' || !allowed.includes(v)) errors.push(message || `${field} must be one of: ${allowed.join(', ')}`);
    return v;
};

function finish(errors, value) {
    if (errors.length) throw new HttpError(400, errors.join(', '), errors);
    return value;
}

const isObject = (b) => Boolean(b) && typeof b === 'object' && !Array.isArray(b);

/**
 * Copy allowed fields only. Absent, null and '' count as "not provided" except for rules
 * with `allowEmpty`, where '' is a real value (used to clear optional text).
 * With `partial` (PATCH-style updates) required fields may be missing.
 */
function build(body, rules, partial) {
    if (!isObject(body)) throw new HttpError(400, 'Expected a JSON object');
    const errors = [];
    const value = {};
    for (const [field, rule] of Object.entries(rules)) {
        const v = body[field];
        const present = v !== undefined && v !== null && (v !== '' || rule.allowEmpty);
        if (!present) {
            if (!partial && rule.required) errors.push(`${field} is required`);
            continue;
        }
        value[rule.column || field] = rule.parse(v, field, errors);
    }
    if (partial && Object.keys(value).length === 0 && errors.length === 0) errors.push('Nothing to update');
    return { errors, value };
}
const run = (body, rules, partial) => {
    const { errors, value } = build(body, rules, partial);
    return finish(errors, value);
};

const transactionRules = {
    description: { allowEmpty: true, parse: (v, f, errors) => text(v, f, { min: 0, max: 200, errors }) },
    amount: { required: true, parse: (v, f, errors) => money(v, f, { errors }) },
    type: { required: true, parse: oneOf(TRANSACTION_TYPES, 'type must be income or expense') },
    category: { required: true, parse: (v, f, errors) => category(v, f, errors) },
    date: { required: false, parse: (v, f, errors) => transactionDate(v, f, errors) },
    notes: { allowEmpty: true, parse: (v, f, errors) => text(v, f, { min: 0, max: 500, multiline: true, errors }) },
    payment_method: { parse: oneOf(PAYMENT_METHODS) },
    payee_key: { parse: (v, f, errors) => payeeKey(v, f, errors) },
};
const importRowRules = { ...transactionRules, date: { ...transactionRules.date, required: true } };

const budgetRules = {
    category: { required: true, parse: (v, f, errors) => category(v, f, errors) },
    limit: { required: true, column: 'limit_amount', parse: (v, f, errors) => money(v, f, { errors }) },
};

function dueDate(v, field, errors, { allowPast }) {
    const d = parseIsoDate(v);
    if (!d) {
        errors.push(`${field} must be a valid date (YYYY-MM-DD)`);
        return undefined;
    }
    const day = d.toISOString().slice(0, 10);
    // One day of slack so a user west of UTC can still pick "today" in their own time zone.
    const earliest = new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
    if (!allowPast && day < earliest) errors.push(`${field} cannot be in the past`);
    return day;
}

const savingsRules = (partial) => ({
    title: { required: true, parse: (v, f, errors) => text(v, f, { max: 100, errors }) },
    target_amount: { required: true, parse: (v, f, errors) => money(v, f, { errors }) },
    current_amount: { required: false, parse: (v, f, errors) => money(v, f, { allowZero: true, errors }) },
    category: { allowEmpty: true, parse: (v, f, errors) => text(v, f, { min: 0, max: 50, errors }) },
    due_date: { required: false, parse: (v, f, errors) => dueDate(v, f, errors, { allowPast: partial }) },
});

const parseTransaction = (body, partial = false) => run(body, transactionRules, partial);
const parseBudget = (body, partial = false) =>
    run(body, partial ? { limit: budgetRules.limit } : budgetRules, partial);

/** Throws when current_amount is more than 10 times target_amount (both must be known). */
function checkGoalAmounts(target, current) {
    if (target === undefined || current === undefined || target === null || current === null) return;
    if (Number(current) > Number(target) * 10) {
        const msg = 'current_amount cannot be more than 10 times target_amount';
        throw new HttpError(400, msg, [msg]);
    }
}
function parseSavingsGoal(body, partial = false) {
    const value = run(body, savingsRules(partial), partial);
    checkGoalAmounts(value.target_amount, value.current_amount);
    return value;
}

/**
 * Validates one import row. Returns { value } or { errors }; never throws, so a
 * bad row is reported by index instead of failing the whole import.
 */
function validateImportRow(row) {
    if (!isObject(row)) return { errors: ['Expected a JSON object'] };
    const { errors, value } = build(row, importRowRules, false);
    return errors.length ? { errors } : { value };
}

function parseImportBody(body) {
    if (!isObject(body)) throw new HttpError(400, 'Expected a JSON object');
    const errors = [];
    const fileName = body.fileName === undefined || body.fileName === null
        ? (errors.push('fileName is required'), undefined)
        : text(body.fileName, 'fileName', { min: 1, max: 200, errors });
    const { rows } = body;
    if (!Array.isArray(rows)) errors.push('rows must be an array');
    else if (rows.length < 1 || rows.length > 2000) errors.push('rows must contain 1-2000 items');
    return finish(errors, { fileName, rows });
}

function parseCredentials(body, { withName = false } = {}) {
    const errors = [];
    const b = isObject(body) ? body : {};
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email) || email.length > 254) errors.push('A valid email is required');
    const password = typeof b.password === 'string' ? b.password : '';
    if (withName) {
        const problem = passwordProblem(password);
        if (problem) errors.push(problem);
    } else if (!password) errors.push('Password is required');
    else if (password.length > 1024) errors.push('Password is too long');
    const out = { email, password };
    if (withName) {
        if (b.name === undefined || b.name === null) errors.push('name is required');
        else out.name = personName(b.name, 'name', errors);
    }
    return finish(errors, out);
}

/** Returns an error message for a weak password, or null. */
function passwordProblem(password) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 72) return 'Password must be 8-72 characters';
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return 'Password needs an uppercase letter, a lowercase letter and a digit';
    }
    return null;
}

function parsePasswordChange(body) {
    const b = isObject(body) ? body : {};
    const errors = [];
    if (typeof b.currentPassword !== 'string' || !b.currentPassword) errors.push('currentPassword is required');
    else if (b.currentPassword.length > 1024) errors.push('currentPassword is too long');
    const problem = passwordProblem(b.newPassword);
    if (problem) errors.push(`New password: ${problem.charAt(0).toLowerCase()}${problem.slice(1)}`);
    else if (b.newPassword === b.currentPassword) errors.push('New password must be different from the current one');
    return finish(errors, { currentPassword: b.currentPassword, newPassword: b.newPassword });
}

const PREFERENCE_FIELDS = [
    'theme',
    'currency',
    'notifications',
    'month_start_day',
    'date_format',
    'week_start',
    'monthly_income_target',
    'budget_alerts',
];

const preferenceRules = {
    theme: (v, f, errors) => oneOf(THEMES, 'theme must be light or dark')(v, f, errors),
    currency: (v, f, errors) => oneOf(CURRENCIES)(v, f, errors),
    notifications: (v, f, errors) => bool(v, f, errors),
    month_start_day: (v, f, errors) => {
        if (!Number.isInteger(v) || v < 1 || v > 28) errors.push(`${f} must be a whole number from 1 to 28`);
        return v;
    },
    date_format: (v, f, errors) => oneOf(DATE_FORMATS)(v, f, errors),
    week_start: (v, f, errors) => oneOf(WEEK_STARTS, 'week_start must be monday or sunday')(v, f, errors),
    monthly_income_target: (v, f, errors) => (v === null ? null : money(v, f, { errors })),
    budget_alerts: (v, f, errors) => bool(v, f, errors),
    name: (v, f, errors) => personName(v, f, errors),
};
function bool(v, f, errors) {
    if (typeof v !== 'boolean') errors.push(`${f} must be true or false`);
    return v;
}

function parsePreferences(body) {
    const b = isObject(body) ? body : {};
    const errors = [];
    const value = {};
    for (const [k, parse] of Object.entries(preferenceRules)) {
        if (b[k] === undefined) continue;
        if (b[k] === null && k !== 'monthly_income_target') {
            errors.push(`${k} cannot be empty`);
            continue;
        }
        value[k] = parse(b[k], k, errors);
    }
    if (!errors.length && !Object.keys(value).length) errors.push('Nothing to update');
    return finish(errors, value);
}

/** Query string for listing, summarising and exporting transactions. */
function parseTransactionQuery(query) {
    const q = isObject(query) ? query : {};
    const errors = [];
    const out = { page: 1, limit: 100 };
    const get = (key) => {
        const v = q[key];
        if (v === undefined || v === '') return undefined;
        if (typeof v !== 'string') {
            errors.push(`${key} must be given once`);
            return undefined;
        }
        return v;
    };
    const int = (key, min, max) => {
        const v = get(key);
        if (v === undefined) return;
        if (!/^\d{1,6}$/.test(v) || Number(v) < min || Number(v) > max) errors.push(`${key} must be a whole number from ${min} to ${max}`);
        else out[key] = Number(v);
    };
    int('page', 1, 10000);
    int('limit', 1, 500);

    const type = get('type');
    if (type !== undefined) {
        if (TRANSACTION_TYPES.includes(type)) out.type = type;
        else errors.push('type must be income or expense');
    }
    for (const [key, max] of [['category', 50], ['q', 100]]) {
        const v = get(key);
        if (v === undefined) continue;
        const s = stripControl(v).trim();
        if (s.length > max) errors.push(`${key} must be at most ${max} characters`);
        else if (s) out[key] = s;
    }
    const source = get('source');
    if (source !== undefined) {
        if (SOURCES.includes(source)) out.source = source;
        else errors.push('source must be manual or import');
    }
    const method = get('payment_method');
    if (method !== undefined) {
        if (PAYMENT_METHODS.includes(method)) out.payment_method = method;
        else errors.push(`payment_method must be one of: ${PAYMENT_METHODS.join(', ')}`);
    }
    for (const key of ['startDate', 'endDate']) {
        const v = get(key);
        if (v === undefined) continue;
        const d = parseIsoDate(v);
        if (!d) {
            errors.push(`${key} must be a valid ISO date (YYYY-MM-DD)`);
            continue;
        }
        // A date-only endDate includes that whole day.
        if (key === 'endDate' && isDateOnly(v)) d.setUTCHours(23, 59, 59, 999);
        out[key] = d.toISOString();
    }
    if (out.startDate && out.endDate && out.endDate < out.startDate) errors.push('endDate must be on or after startDate');
    return finish(errors, out);
}

module.exports = {
    parsePayee,
    parsePayeeKey,
    isUuid,
    stripControl,
    parseIsoDate,
    parseTransaction,
    parseBudget,
    parseSavingsGoal,
    checkGoalAmounts,
    validateImportRow,
    parseImportBody,
    parseCredentials,
    parsePasswordChange,
    parsePreferences,
    parseTransactionQuery,
    PREFERENCE_FIELDS,
    PAYMENT_METHODS,
    CURRENCIES,
};
