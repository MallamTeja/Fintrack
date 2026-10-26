import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import Money from '../components/Money.jsx';
import { Meter } from '../components/Charts.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createGoal, deleteGoal, fetchGoals, patchGoal, updateGoal } from '../lib/data.js';
import { formatDate, monthsUntil, percent } from '../lib/format.js';
import { invalidate, useResource } from '../lib/useResource.js';
import { parseAmount, validateAmount } from '../lib/validate.js';
import { ConfirmDelete, ErrorNote } from './shared.jsx';
import './Plans.css';

function GoalForm({ initial, onSubmit, error }) {
  const [v, setV] = useState({
    title: initial?.title || '',
    target: initial ? String(initial.target_amount) : '',
    current: initial ? String(initial.current_amount) : '',
    category: initial?.category || '',
    due: initial?.due_date || '',
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!v.title.trim()) errs.title = 'Name the goal.';
    else if (v.title.trim().length > 100) errs.title = 'Keep the name under 100 characters.';
    const t = validateAmount(v.target);
    if (t) errs.target = t.replace('Amount', 'Target');
    if (v.current.trim() !== '') {
      const c = parseAmount(v.current);
      if (Number.isNaN(c) || c < 0) errs.current = 'Enter zero or more.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit({
      title: v.title.trim(),
      target_amount: parseAmount(v.target),
      current_amount: v.current.trim() === '' ? 0 : parseAmount(v.current),
      category: v.category.trim() || undefined,
      due_date: v.due || undefined,
    });
  };

  const f = (k, label, props = {}, hint) => (
    <div className="field">
      <label className="field__label" htmlFor={`g-${k}`}>
        {label}
      </label>
      <input
        id={`g-${k}`}
        className="input"
        value={v[k]}
        onChange={set(k)}
        aria-invalid={errors[k] ? 'true' : undefined}
        aria-describedby={`g-${k}-err`}
        {...props}
      />
      {hint && <p className="field__hint">{hint}</p>}
      <p id={`g-${k}-err`} className="field__error">
        {errors[k]}
      </p>
    </div>
  );

  return (
    <form id="goal-form" className="planform" onSubmit={submit} noValidate>
      {error && (
        <p className="planform__error" role="alert">
          {error}
        </p>
      )}
      {f('title', 'Goal', { maxLength: 100, 'data-autofocus': true, placeholder: 'Emergency fund' })}
      <div className="planform__pair">
        {f('target', 'Target', { inputMode: 'decimal', className: 'input input--money', placeholder: '0.00' })}
        {f('current', 'Saved so far', { inputMode: 'decimal', className: 'input input--money', placeholder: '0.00' })}
      </div>
      <div className="planform__pair">
        {f('category', 'Label', { maxLength: 50 }, 'Optional, for example Travel.')}
        {f('due', 'Target date', { type: 'date' }, 'Optional.')}
      </div>
    </form>
  );
}

function AddMoneyForm({ goal, onSubmit }) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const err = validateAmount(amount);
    setError(err);
    if (!err) onSubmit(parseAmount(amount));
  };
  return (
    <form id="addmoney-form" className="planform" onSubmit={submit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="am-amount">
          Amount to add to {goal.title}
        </label>
        <input
          id="am-amount"
          className="input input--money"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby="am-amount-err"
          data-autofocus
        />
        <p id="am-amount-err" className="field__error">
          {error}
        </p>
      </div>
    </form>
  );
}

function dueText(goal) {
  if (!goal.due_date) return 'No target date';
  const m = monthsUntil(goal.due_date);
  const when = formatDate(goal.due_date);
  if (m < 0) return `Was due ${when}`;
  if (m === 0) return `Due ${when}, this month`;
  return `Due ${when}, in ${m} ${m === 1 ? 'month' : 'months'}`;
}

export default function Savings() {
  const notify = useToast();
  const goals = useResource(fetchGoals, { keys: ['savings'] });
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const list = goals.data || [];

  async function save(payload) {
    setBusy(true);
    setFormError('');
    try {
      if (editing === 'new') {
        const created = await createGoal(payload);
        goals.setData((d) => [...(d || []), created]);
      } else {
        goals.setData((d) => d.map((g) => (g.id === editing.id ? { ...g, ...payload } : g)));
        await updateGoal(editing.id, payload);
      }
      setEditing(null);
      invalidate('savings');
    } catch (err) {
      setFormError(err.message);
      if (editing !== 'new') invalidate('savings');
    } finally {
      setBusy(false);
    }
  }

  async function addMoney(amount) {
    const goal = adding;
    const before = goals.data;
    const next = Math.round((goal.current_amount + amount) * 100) / 100;
    setAdding(null);
    goals.setData((d) => d.map((g) => (g.id === goal.id ? { ...g, current_amount: next } : g)));
    try {
      await patchGoal(goal.id, { current_amount: next });
    } catch (err) {
      goals.setData(before);
      notify(`Could not add to ${goal.title}: ${err.message}`);
    }
  }

  async function remove(goal) {
    const before = goals.data;
    setConfirm(null);
    goals.setData((d) => d.filter((g) => g.id !== goal.id));
    try {
      await deleteGoal(goal.id);
    } catch (err) {
      goals.setData(before);
      notify(`Could not delete ${goal.title}: ${err.message}`);
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">Savings</h1>
          <p className="page__lede">Money set aside for something specific, and how much is still to go.</p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setFormError('');
            setEditing('new');
          }}
        >
          <Icon name="plus" size={18} />
          New goal
        </button>
      </header>

      <ErrorNote error={goals.error} onRetry={() => goals.refetch()} />
      {goals.loading && !goals.data && <span className="skeleton plan-skeleton" />}

      {goals.data && list.length === 0 && (
        <div className="empty">
          <p className="empty__title">No goals yet</p>
          <p>Name something you are saving for, set a target, and add to it whenever you put money away.</p>
          <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
            Start a goal
          </button>
        </div>
      )}

      {list.length > 0 && (
        <ul className="plans plans--goals">
          {list.map((g) => {
            const pct = percent(g.current_amount, g.target_amount);
            const left = Math.max(g.target_amount - g.current_amount, 0);
            const done = left === 0;
            return (
              <li key={g.id} className="plan">
                <div className="plan__head">
                  <h2 className="plan__title">{g.title}</h2>
                  <span className={`plan__state plan__state--${done ? 'done' : 'ok'} num`}>
                    {done ? 'Reached' : `${Math.floor(pct)}%`}
                  </span>
                </div>
                <p className="plan__meta muted">
                  {g.category ? `${g.category} · ` : ''}
                  {dueText(g)}
                </p>
                <p className="plan__figures">
                  <Money amount={g.current_amount} size="lg" />
                  <span className="muted"> of </span>
                  <Money amount={g.target_amount} size="sm" className="muted" />
                </p>
                <Meter value={g.current_amount} max={g.target_amount} label={`${g.title} progress`} tone="goal" />
                <p className="plan__left">
                  {done ? (
                    'Target reached.'
                  ) : (
                    <>
                      <Money amount={left} size="sm" /> <span className="muted">left to save</span>
                    </>
                  )}
                </p>
                <div className="plan__actions">
                  <button type="button" className="btn" onClick={() => setAdding(g)}>
                    <Icon name="coin" size={18} />
                    Add money
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      setFormError('');
                      setEditing(g);
                    }}
                    aria-label={`Edit ${g.title}`}
                  >
                    <Icon name="edit" size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => setConfirm(g)}
                    aria-label={`Delete ${g.title}`}
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New savings goal' : 'Edit goal'}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="goal-form" className="btn btn--primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save goal'}
            </button>
          </>
        }
      >
        {editing && (
          <GoalForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onSubmit={save} error={formError} />
        )}
      </Modal>

      <Modal
        open={Boolean(adding)}
        onClose={() => setAdding(null)}
        variant="dialog"
        title="Add money"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setAdding(null)}>
              Cancel
            </button>
            <button type="submit" form="addmoney-form" className="btn btn--primary">
              Add
            </button>
          </>
        }
      >
        {adding && <AddMoneyForm goal={adding} onSubmit={addMoney} />}
      </Modal>

      <ConfirmDelete
        open={Boolean(confirm)}
        title="Delete this goal?"
        body={confirm ? `${confirm.title} and its progress will be removed. This cannot be undone.` : ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => remove(confirm)}
      />
    </div>
  );
}
