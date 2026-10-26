import { validateAmount, validateCategory, validateDescription, validateEntryDate, validateNotes, validateType } from '../validate.js';

/** Errors for one parsed statement row, with the same rules the API applies. */
export function validateDraft(d, { today } = {}) {
  const errors = {};
  const date = d.date
    ? validateEntryDate(d.date, { required: true, today })
    : `Date not recognised${d.rawDate ? `: "${String(d.rawDate).slice(0, 30)}"` : ''}.`;
  const checks = {
    date,
    amount: validateAmount(d.amount),
    type: validateType(d.type),
    category: validateCategory(d.category),
    description: validateDescription(d.description),
    notes: validateNotes(d.notes),
  };
  Object.entries(checks).forEach(([k, v]) => {
    if (v) errors[k] = v;
  });
  return errors;
}

/** The payload the import endpoint expects for one row. */
export function toImportRow(d) {
  const row = {
    date: d.date,
    description: d.description.trim(),
    amount: d.amount,
    type: d.type,
    category: d.category.trim(),
    payment_method: d.payment_method || 'other',
  };
  if (d.notes && d.notes.trim()) row.notes = d.notes.trim().slice(0, 500);
  return row;
}
