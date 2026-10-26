// Input validation. Each parser returns a clean object with only allowed fields
// or throws HttpError(400) listing every problem.
const { HttpError } = require('./http');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_AMOUNT = 1_000_000_000;

const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v);

function text(v, field, { min = 1, max = 100, errors }) {
    if (typeof v !== 'string') {
        errors.push(`${field} must be text`);
        return undefined;
    }
    const s = v.trim();
    if (s.length < min || s.length > max) errors.push(`${field} must be ${min}-${max} characters`);
    return s;
}

function money(v, field, { allowZero = false, errors }) {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    if (typeof n !== 'number' || !Number.isFinite(n)) {
        errors.push(`${field} must be a number`);
        return undefined;
    }
    if (allowZero ? n < 0 : n <= 0) errors.push(`${field} must be ${allowZero ? 'zero or more' : 'greater than 0'}`);
    if (n > MAX_AMOUNT) errors.push(`${field} is too large`);
    return Math.round(n * 100) / 100;
}

function date(v, field, { errors }) {
    const d = typeof v === 'string' || typeof v === 'number' ? new Date(v) : null;
    if (!d || Number.isNaN(d.getTime())) {
        errors.push(`${field} must be a valid date`);
        return undefined;
    }
    return d.toISOString();
}

function finish(errors, value) {
    if (errors.length) throw new HttpError(400, errors.join(', '), errors);
    return value;
}

/** Only copy fields that are present when `partial` (PATCH-style updates). */
function build(body, rules, partial) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Expected a JSON object');
    const errors = [];
    const value = {};
    for (const [field, rule] of Object.entries(rules)) {
        const present = body[field] !== undefined && body[field] !== null && body[field] !== '';
        if (!present) {
            if (!partial && rule.required) errors.push(`${field} is required`);
            continue;
        }
        value[rule.column || field] = rule.parse(body[field], field, errors);
    }
    if (partial && Object.keys(value).length === 0 && errors.length === 0) errors.push('Nothing to update');
    return finish(errors, value);
}

const transactionRules = {
    description: { required: true, parse: (v, f, errors) => text(v, f, { max: 200, errors }) },
    amount: { required: true, parse: (v, f, errors) => money(v, f, { errors }) },
    type: {
        required: true,
        parse: (v, f, errors) => {
            if (v !== 'income' && v !== 'expense') errors.push('type must be income or expense');
            return v;
        },
    },
    category: { required: true, parse: (v, f, errors) => text(v, f, { max: 50, errors }) },
    date: { required: false, parse: (v, f, errors) => date(v, f, { errors }) },
};

const budgetRules = {
    category: { required: true, parse: (v, f, errors) => text(v, f, { max: 50, errors }) },
    limit: { required: true, column: 'limit_amount', parse: (v, f, errors) => money(v, f, { errors }) },
};

const savingsRules = {
    title: { required: true, parse: (v, f, errors) => text(v, f, { max: 100, errors }) },
    target_amount: { required: true, parse: (v, f, errors) => money(v, f, { errors }) },
    current_amount: { required: false, parse: (v, f, errors) => money(v, f, { allowZero: true, errors }) },
    category: { required: false, parse: (v, f, errors) => text(v, f, { max: 50, errors }) },
    due_date: { required: false, parse: (v, f, errors) => (date(v, f, { errors }) || '').slice(0, 10) },
};

const parseTransaction = (body, partial = false) => build(body, transactionRules, partial);
const parseBudget = (body, partial = false) =>
    build(body, partial ? { limit: budgetRules.limit } : budgetRules, partial);
const parseSavingsGoal = (body, partial = false) => build(body, savingsRules, partial);

function parseCredentials(body, { withName = false } = {}) {
    const errors = [];
    const b = body && typeof body === 'object' ? body : {};
    const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
    if (!EMAIL_RE.test(email) || email.length > 254) errors.push('A valid email is required');
    const password = typeof b.password === 'string' ? b.password : '';
    if (withName) {
        if (password.length < 8 || password.length > 72) errors.push('Password must be 8-72 characters');
        else if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))
            errors.push('Password needs an uppercase letter, a lowercase letter and a digit');
    } else if (!password) errors.push('Password is required');
    const out = { email, password };
    if (withName) out.name = text(b.name, 'name', { min: 1, max: 60, errors });
    return finish(errors, out);
}

const PREFS = {
    theme: (v) => ['light', 'dark'].includes(v),
    currency: (v) => typeof v === 'string' && /^[A-Z]{3}$/.test(v),
    notifications: (v) => typeof v === 'boolean',
};
function parsePreferences(body) {
    const b = body && typeof body === 'object' ? body : {};
    const errors = [];
    const value = {};
    for (const [k, ok] of Object.entries(PREFS)) {
        if (b[k] === undefined) continue;
        if (ok(b[k])) value[k] = b[k];
        else errors.push(`Invalid ${k}`);
    }
    if (!errors.length && !Object.keys(value).length) errors.push('Nothing to update');
    return finish(errors, value);
}

module.exports = {
    isUuid,
    parseTransaction,
    parseBudget,
    parseSavingsGoal,
    parseCredentials,
    parsePreferences,
};
