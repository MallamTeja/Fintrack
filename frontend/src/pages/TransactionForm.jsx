import { useEffect, useRef } from 'react';
import { CharCount, LabelRow } from '../components/Field.jsx';
import { categoryOptions } from '../lib/categories.js';
import { isoDay } from '../lib/format.js';
import { focusFirstError, useForm } from '../lib/useForm.js';
import { LIMITS, MIN_DATE, PAYMENT_METHODS, maxEntryDate, parseAmount, validateTransaction } from '../lib/validate.js';

const blank = () => ({
  type: 'expense',
  amount: '',
  description: '',
  category: '',
  date: isoDay(new Date()),
  payment_method: 'other',
  notes: '',
});

const fromInitial = (initial) => ({
  type: initial.type === 'income' ? 'income' : 'expense',
  amount: initial.amount === undefined || initial.amount === null ? '' : String(initial.amount),
  description: initial.description || '',
  category: initial.category || '',
  date: initial.date || isoDay(new Date()),
  payment_method: initial.payment_method || 'other',
  notes: initial.notes || '',
});

/**
 * Add or edit one entry. Calls onSubmit with a clean payload only when every field is valid.
 * categories: [{ category, type, count }] or plain strings, for autocomplete.
 * initialErrors: field errors from a failed save, shown straight away.
 */
export default function TransactionForm({ id = 'tx-form', initial, categories = [], initialErrors, onSubmit }) {
  const form = useForm(initial ? fromInitial(initial) : blank(), (v) => validateTransaction(v));
  const { values, errors, bind, setValue } = form;
  const formRef = useRef(null);
  const options = categoryOptions(categories, values.type);

  useEffect(() => {
    if (initialErrors && Object.keys(initialErrors).length) form.setServerErrors(initialErrors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e) => {
    e.preventDefault();
    const errs = form.validateAll();
    if (Object.keys(errs).length) {
      focusFirstError(formRef.current, errs);
      return;
    }
    const notes = values.notes.trim();
    onSubmit({
      type: values.type,
      amount: parseAmount(values.amount),
      description: values.description.trim(),
      category: values.category.trim(),
      date: values.date || undefined,
      payment_method: values.payment_method,
      notes,
    });
  };

  const ids = (k) => `${id}-${k}`;
  const errText = (k) => (
    <p id={`${ids(k)}-err`} className="field__error">
      {errors[k]}
    </p>
  );

  return (
    <form id={id} ref={formRef} className="txform" onSubmit={submit} noValidate>
      {errors._form && (
        <p className="planform__error" role="alert">
          {errors._form}
        </p>
      )}
      <fieldset className="txform__type">
        <legend className="field__label">Kind of entry</legend>
        <div className="seg">
          {[
            ['expense', 'Spending'],
            ['income', 'Income'],
          ].map(([v, label]) => (
            <label key={v} className="seg__opt">
              <input type="radio" name="type" value={v} checked={values.type === v} onChange={() => setValue('type', v)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor={ids('amount')}>
          Amount
        </label>
        <input
          id={ids('amount')}
          className="input input--money"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          maxLength={LIMITS.amountChars}
          data-autofocus
          {...bind('amount', { describedBy: [`${ids('amount')}-err`] })}
        />
        {errText('amount')}
      </div>

      <div className="field">
        <LabelRow
          htmlFor={ids('description')}
          count={<CharCount id={`${ids('description')}-count`} value={values.description} max={LIMITS.description} />}
        >
          Description (optional)
        </LabelRow>
        <input
          id={ids('description')}
          className="input"
          maxLength={LIMITS.description}
          autoComplete="off"
          placeholder="What was it for?"
          {...bind('description', { describedBy: [`${ids('description')}-err`, `${ids('description')}-count`] })}
        />
        {errText('description')}
      </div>

      <div className="txform__pair">
        <div className="field">
          <label className="field__label" htmlFor={ids('category')}>
            Category
          </label>
          <input
            id={ids('category')}
            className="input"
            list={`${id}-cats`}
            maxLength={LIMITS.category}
            autoComplete="off"
            {...bind('category', { describedBy: [`${ids('category')}-err`] })}
          />
          <datalist id={`${id}-cats`}>
            {options.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {errText('category')}
        </div>
        <div className="field">
          <label className="field__label" htmlFor={ids('date')}>
            Date
          </label>
          <input
            id={ids('date')}
            type="date"
            className="input"
            min={MIN_DATE}
            max={maxEntryDate()}
            {...bind('date', { describedBy: [`${ids('date')}-err`] })}
          />
          {errText('date')}
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor={ids('payment_method')}>
          Payment method
        </label>
        <select id={ids('payment_method')} className="input" {...bind('payment_method', { describedBy: [`${ids('payment_method')}-err`] })}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {errText('payment_method')}
      </div>

      <div className="field">
        <LabelRow htmlFor={ids('notes')} count={<CharCount id={`${ids('notes')}-count`} value={values.notes} max={LIMITS.notes} />}>
          Notes (optional)
        </LabelRow>
        <textarea
          id={ids('notes')}
          className="input"
          rows={3}
          maxLength={LIMITS.notes}
          {...bind('notes', { describedBy: [`${ids('notes')}-err`, `${ids('notes')}-count`] })}
        />
        {errText('notes')}
      </div>
    </form>
  );
}
