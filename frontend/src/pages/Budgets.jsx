import { useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import Money from '../components/Money.jsx';
import { Meter } from '../components/Charts.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createBudget, deleteBudget, fetchBudgets, updateBudget } from '../lib/data.js';
import { categoryOptions, useCategories } from '../lib/categories.js';
import { formatMoney, formatMonth, percent } from '../lib/format.js';
import { focusFirstError, useForm } from '../lib/useForm.js';
import { invalidate, useResource } from '../lib/useResource.js';
import { LIMITS, parseAmount, validateBudget } from '../lib/validate.js';
import { ConfirmDelete, ErrorNote } from './shared.jsx';
import './Plans.css';

function BudgetForm({ initial, onSubmit, error, categories }) {
  const isNew = !initial;
  const ref = useRef(null);
  const form = useForm({ category: initial?.category || '', limit: initial ? String(initial.limit) : '' }, (v) =>
    validateBudget(v, { isNew })
  );
  const { errors, bind } = form;

  const submit = (e) => {
    e.preventDefault();
    const errs = form.validateAll();
    if (Object.keys(errs).length) {
      focusFirstError(ref.current, errs);
      return;
    }
    onSubmit({ category: form.values.category.trim(), limit: parseAmount(form.values.limit) });
  };

  return (
    <form id="budget-form" ref={ref} className="planform" onSubmit={submit} noValidate>
      {error && (
        <p className="planform__error" role="alert">
          {error}
        </p>
      )}
      {initial ? (
        <p className="planform__fixed">
          <span className="muted">Category</span>
          <strong>{initial.category}</strong>
        </p>
      ) : (
        <div className="field">
          <label className="field__label" htmlFor="b-category">
            Category
          </label>
          <input
            id="b-category"
            className="input"
            maxLength={LIMITS.category}
            list="b-category-list"
            autoComplete="off"
            data-autofocus
            {...bind('category', { describedBy: ['b-category-err', 'b-category-hint'] })}
          />
          <datalist id="b-category-list">
            {categoryOptions(categories, 'expense').map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <p id="b-category-hint" className="field__hint">
            Match the category you use on expenses, for example Food.
          </p>
          <p id="b-category-err" className="field__error">
            {errors.category}
          </p>
        </div>
      )}
      <div className="field">
        <label className="field__label" htmlFor="b-limit">
          Monthly limit
        </label>
        <input
          id="b-limit"
          className="input input--money"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          maxLength={LIMITS.amountChars}
          data-autofocus={initial ? true : undefined}
          {...bind('limit', { describedBy: ['b-limit-err'] })}
        />
        <p id="b-limit-err" className="field__error">
          {errors.limit}
        </p>
      </div>
    </form>
  );
}

/** Days after today in this month, and a per-day allowance for what is left (today included). */
export function monthPace(remaining, today = new Date()) {
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysLeft = last - today.getDate();
  return { daysLeft, perDay: remaining > 0 ? remaining / (daysLeft + 1) : 0 };
}

function status(b, currency) {
  const pct = percent(b.current_spending, b.limit);
  if (pct > 100) return { tone: 'out', text: `Over by ${formatMoney(b.current_spending - b.limit, currency)}` };
  if (pct >= 80) return { tone: 'warn', text: `${Math.round(pct)}% used` };
  return { tone: 'ok', text: `${Math.round(pct)}% used` };
}

function BudgetPace({ b, today, monthName }) {
  const { currency } = useAuth();
  const remaining = Math.max(b.limit - b.current_spending, 0);
  const { daysLeft, perDay } = monthPace(remaining, today);
  const days = daysLeft === 0 ? `Last day of ${monthName}` : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left in ${monthName}`;
  return (
    <p className="plan__left">
      {remaining > 0 ? (
        <>
          <Money amount={remaining} size="sm" /> <span className="muted">remaining · {days}</span>
          {perDay > 0 && (
            <span className="muted">
              {' '}
              · about <span className="num">{formatMoney(perDay, currency)}</span> a day
            </span>
          )}
        </>
      ) : (
        <span className="muted">Nothing remaining · {days}</span>
      )}
    </p>
  );
}

export default function Budgets() {
  const { currency } = useAuth();
  const notify = useToast();
  const budgets = useResource(fetchBudgets, { keys: ['budgets', 'transactions'] });
  const categories = useCategories();
  const today = new Date();
  const monthName = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(today);
  const [editing, setEditing] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const list = budgets.data || [];
  const totalLimit = list.reduce((s, b) => s + b.limit, 0);
  const totalSpent = list.reduce((s, b) => s + b.current_spending, 0);

  const open = (b) => {
    setFormError('');
    setEditing(b);
  };

  async function save({ category, limit }) {
    setBusy(true);
    setFormError('');
    try {
      if (editing === 'new') {
        const created = await createBudget({ category, limit });
        budgets.setData((d) => [...(d || []), created]);
      } else {
        budgets.setData((d) => d.map((b) => (b.id === editing.id ? { ...b, limit } : b)));
        await updateBudget(editing.id, limit);
      }
      setEditing(null);
      invalidate('budgets');
    } catch (err) {
      setFormError(
        err.status === 409
          ? `There is already a budget for ${category}. Edit that one instead.`
          : err.status === 400
            ? `Not saved: ${err.message}`
            : err.message
      );
      if (editing !== 'new') invalidate('budgets');
    } finally {
      setBusy(false);
    }
  }

  async function remove(b) {
    const before = budgets.data;
    setConfirm(null);
    budgets.setData((d) => d.filter((x) => x.id !== b.id));
    try {
      await deleteBudget(b.id);
    } catch (err) {
      budgets.setData(before);
      notify(`Could not delete the ${b.category} budget: ${err.message}`);
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Budgets</h1>
          <p className="page__lede">
            Monthly limits per spending category for {formatMonth(new Date())}. A limit turns ochre at 80% and brick
            once it is passed.
          </p>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => open('new')}>
          <Icon name="plus" size={18} />
          New budget
        </button>
      </header>

      <ErrorNote error={budgets.error} onRetry={() => budgets.refetch()} />

      {budgets.loading && !budgets.data && <span className="skeleton plan-skeleton" />}

      {budgets.data && list.length === 0 && (
        <div className="empty">
          <p className="empty__title">No budgets yet</p>
          <p>Pick a category you spend on often, such as Food or Transport, and give it a monthly limit.</p>
          <button type="button" className="btn btn--primary" onClick={() => open('new')}>
            Set a first limit
          </button>
        </div>
      )}

      {list.length > 0 && (
        <>
          <dl className="plan-sum">
            <div>
              <dt>Spent</dt>
              <dd>
                <Money amount={totalSpent} size="lg" />
              </dd>
            </div>
            <div>
              <dt>Of total limits</dt>
              <dd>
                <Money amount={totalLimit} size="lg" />
              </dd>
            </div>
          </dl>
          <ul className="plans">
            {list.map((b) => {
              const st = status(b, currency);
              return (
                <li key={b.id} className="plan">
                  <div className="plan__head">
                    <h2 className="plan__title">{b.category}</h2>
                    <span className={`plan__state plan__state--${st.tone}`}>{st.text}</span>
                  </div>
                  <p className="plan__figures">
                    <Money amount={b.current_spending} type={st.tone === 'out' ? 'expense' : undefined} />
                    <span className="muted"> of </span>
                    <Money amount={b.limit} size="sm" className="muted" />
                  </p>
                  <Meter value={b.current_spending} max={b.limit} label={`${b.category}: share of limit used`} />
                  <BudgetPace b={b} today={today} monthName={monthName} />
                  <div className="plan__actions">
                    <button type="button" className="btn btn--quiet" onClick={() => open(b)}>
                      <Icon name="edit" size={18} />
                      Edit limit
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => setConfirm(b)}
                      aria-label={`Delete ${b.category} budget`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New budget' : 'Edit limit'}
        description="Spending in this category counts against the limit from the first of each month."
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="budget-form" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save budget'}
            </button>
          </>
        }
      >
        {editing && (
          <BudgetForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={editing === 'new' ? null : editing}
            onSubmit={save}
            error={formError}
            categories={categories}
          />
        )}
      </Modal>

      <ConfirmDelete
        open={Boolean(confirm)}
        title="Delete this budget?"
        body={confirm ? `The ${confirm.category} limit goes away. Your transactions stay as they are.` : ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => remove(confirm)}
      />
    </div>
  );
}
