import { useState } from 'react';
import { isoDay } from '../lib/format.js';
import { parseAmount, validateTransaction } from '../lib/validate.js';

export const SUGGESTED_CATEGORIES = [
  'Food',
  'Groceries',
  'Rent',
  'Transport',
  'Utilities',
  'Health',
  'Shopping',
  'Entertainment',
  'Salary',
  'Freelance',
];

const blank = () => ({ type: 'expense', amount: '', description: '', category: '', date: isoDay(new Date()) });

/** Add or edit one entry. Calls onSubmit with a clean payload only when every field is valid. */
export default function TransactionForm({ id = 'tx-form', initial, categories = [], onSubmit }) {
  const [values, setValues] = useState(() =>
    initial
      ? {
          type: initial.type,
          amount: String(initial.amount ?? ''),
          description: initial.description || '',
          category: initial.category || '',
          date: initial.date || isoDay(new Date()),
        }
      : blank()
  );
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setValues((v) => ({ ...v, [k]: e.target.value }));
  const options = [...new Set([...categories, ...SUGGESTED_CATEGORIES])];

  const submit = (e) => {
    e.preventDefault();
    const errs = validateTransaction(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = e.currentTarget.querySelector(`[name="${Object.keys(errs)[0]}"]`);
      first?.focus();
      return;
    }
    onSubmit({
      type: values.type,
      amount: Math.round(parseAmount(values.amount) * 100) / 100,
      description: values.description.trim(),
      category: values.category.trim(),
      date: values.date || undefined,
    });
  };

  const err = (k) => ({
    'aria-invalid': errors[k] ? 'true' : undefined,
    'aria-describedby': `${id}-${k}-err`,
  });

  return (
    <form id={id} className="txform" onSubmit={submit} noValidate>
      <fieldset className="txform__type">
        <legend className="field__label">Kind of entry</legend>
        <div className="seg">
          {[
            ['expense', 'Spending'],
            ['income', 'Income'],
          ].map(([v, label]) => (
            <label key={v} className="seg__opt">
              <input type="radio" name="type" value={v} checked={values.type === v} onChange={set('type')} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor={`${id}-amount`}>
          Amount
        </label>
        <input
          id={`${id}-amount`}
          name="amount"
          className="input input--money"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={values.amount}
          onChange={set('amount')}
          data-autofocus
          {...err('amount')}
        />
        <p id={`${id}-amount-err`} className="field__error">
          {errors.amount}
        </p>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={`${id}-description`}>
          Description
        </label>
        <input
          id={`${id}-description`}
          name="description"
          className="input"
          maxLength={200}
          placeholder="What was it for?"
          value={values.description}
          onChange={set('description')}
          {...err('description')}
        />
        <p id={`${id}-description-err`} className="field__error">
          {errors.description}
        </p>
      </div>

      <div className="txform__pair">
        <div className="field">
          <label className="field__label" htmlFor={`${id}-category`}>
            Category
          </label>
          <input
            id={`${id}-category`}
            name="category"
            className="input"
            list={`${id}-cats`}
            maxLength={50}
            autoComplete="off"
            value={values.category}
            onChange={set('category')}
            {...err('category')}
          />
          <datalist id={`${id}-cats`}>
            {options.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p id={`${id}-category-err`} className="field__error">
            {errors.category}
          </p>
        </div>
        <div className="field">
          <label className="field__label" htmlFor={`${id}-date`}>
            Date
          </label>
          <input
            id={`${id}-date`}
            name="date"
            type="date"
            className="input"
            value={values.date}
            onChange={set('date')}
            {...err('date')}
          />
          <p id={`${id}-date-err`} className="field__error">
            {errors.date}
          </p>
        </div>
      </div>
    </form>
  );
}
