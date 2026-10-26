import { useRef, useState } from 'react';
import { CharCount, LabelRow } from '../components/Field.jsx';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import Money from '../components/Money.jsx';
import { Meter } from '../components/Charts.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { createGoal, deleteGoal, fetchGoals, patchGoal, updateGoal } from '../lib/data.js';
import { formatDate, monthsUntil, percent } from '../lib/format.js';
import { invalidate, useResource } from '../lib/useResource.js';
import { focusFirstError, useForm } from '../lib/useForm.js';
import { LIMITS, MIN_DATE, parseAmount, todayIso, validateCategory, validateGoal, validateGoalMove } from '../lib/validate.js';
import { ConfirmDelete, ErrorNote } from './shared.jsx';
import './Plans.css';

function GoalForm({ initial, onSubmit, error }) {
  const isNew = !initial;
  const ref = useRef(null);
  const form = useForm(
    {
      title: initial?.title || '',
      target: initial ? String(initial.target_amount) : '',
      current: initial ? String(initial.current_amount) : '',
      category: initial?.category || '',
      due: initial?.due_date || '',
    },
    (v) => {
      const errs = validateGoal(v, { isNew });
      if (v.category.trim()) {
        const c = validateCategory(v.category);
        if (c) errs.category = c.replace('category', 'label');
      }
      return errs;
    }
  );
  const { values, errors, bind } = form;

  const submit = (e) => {
    e.preventDefault();
    const errs = form.validateAll();
    if (Object.keys(errs).length) {
      focusFirstError(ref.current, errs);
      return;
    }
    onSubmit({
      title: values.title.trim(),
      target_amount: parseAmount(values.target),
      current_amount: values.current.trim() === '' ? 0 : parseAmount(values.current),
      category: values.category.trim() || undefined,
      due_date: values.due || undefined,
    });
  };

  const f = (k, label, props = {}, hint, count) => (
    <div className="field">
      {count ? (
        <LabelRow htmlFor={`g-${k}`} count={count}>
          {label}
        </LabelRow>
      ) : (
        <label className="field__label" htmlFor={`g-${k}`}>
          {label}
        </label>
      )}
      <input id={`g-${k}`} className="input" {...bind(k, { describedBy: [`g-${k}-err`, hint && `g-${k}-hint`, count && `g-${k}-count`] })} {...props} />
      {hint && (
        <p id={`g-${k}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      <p id={`g-${k}-err`} className="field__error">
        {errors[k]}
      </p>
    </div>
  );
  const money = { inputMode: 'decimal', className: 'input input--money', placeholder: '0.00', autoComplete: 'off', maxLength: LIMITS.amountChars };

  return (
    <form id="goal-form" ref={ref} className="planform" onSubmit={submit} noValidate>
      {error && (
        <p className="planform__error" role="alert">
          {error}
        </p>
      )}
      {f(
        'title',
        'Goal',
        { maxLength: LIMITS.title, 'data-autofocus': true, placeholder: 'Emergency fund', autoComplete: 'off' },
        null,
        <CharCount id="g-title-count" value={values.title} max={LIMITS.title} />
      )}
      <div className="planform__pair">
        {f('target', 'Target', money)}
        {f('current', 'Saved so far', money, 'Up to 10 times the target.')}
      </div>
      <div className="planform__pair">
        {f('category', 'Label', { maxLength: LIMITS.category, autoComplete: 'off' }, 'Optional, for example Travel.')}
        {f('due', 'Target date', { type: 'date', min: isNew ? todayIso() : MIN_DATE }, isNew ? 'Optional. Today or later.' : 'Optional.')}
      </div>
    </form>
  );
}

function MoveMoneyForm({ goal, mode, onModeChange, onSubmit }) {
  const ref = useRef(null);
  const form = useForm({ amount: '' }, (v) => {
    const e = validateGoalMove(v.amount, goal, mode);
    return e ? { amount: e } : {};
  });
  const submit = (e) => {
    e.preventDefault();
    const errs = form.validateAll();
    if (Object.keys(errs).length) {
      focusFirstError(ref.current, errs);
      return;
    }
    onSubmit(parseAmount(form.values.amount));
  };
  return (
    <form id="move-form" ref={ref} className="planform" onSubmit={submit} noValidate>
      <fieldset className="txform__type">
        <legend className="field__label">Move money</legend>
        <div className="seg">
          {[
            ['add', 'Add money'],
            ['withdraw', 'Withdraw'],
          ].map(([v, label]) => (
            <label key={v} className="seg__opt">
              <input type="radio" name="move-mode" value={v} checked={mode === v} onChange={() => onModeChange(v)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label className="field__label" htmlFor="am-amount">
          {mode === 'withdraw' ? `Amount to take from ${goal.title}` : `Amount to add to ${goal.title}`}
        </label>
        <input
          id="am-amount"
          className="input input--money"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          maxLength={LIMITS.amountChars}
          data-autofocus
          {...form.bind('amount', { describedBy: ['am-amount-err', 'am-amount-hint'] })}
        />
        <p id="am-amount-hint" className="field__hint">
          Saved so far: <Money amount={goal.current_amount} size="sm" />
        </p>
        <p id="am-amount-err" className="field__error">
          {form.errors.amount}
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
  const [moving, setMoving] = useState(null); // { goal, mode }
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

  async function moveMoney(amount) {
    const { goal, mode } = moving;
    const before = goals.data;
    const delta = mode === 'withdraw' ? -amount : amount;
    const next = Math.round((goal.current_amount + delta) * 100) / 100;
    setMoving(null);
    goals.setData((d) => d.map((g) => (g.id === goal.id ? { ...g, current_amount: next } : g)));
    try {
      await patchGoal(goal.id, { current_amount: next });
      invalidate('savings');
    } catch (err) {
      goals.setData(before);
      notify(`Could not ${mode === 'withdraw' ? 'withdraw from' : 'add to'} ${goal.title}: ${err.message}`);
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
                  <button type="button" className="btn" onClick={() => setMoving({ goal: g, mode: 'add' })}>
                    <Icon name="coin" size={18} />
                    Add money
                  </button>
                  <button
                    type="button"
                    className="btn btn--quiet"
                    onClick={() => setMoving({ goal: g, mode: 'withdraw' })}
                    disabled={g.current_amount <= 0}
                  >
                    Withdraw
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
        open={Boolean(moving)}
        onClose={() => setMoving(null)}
        variant="dialog"
        title={moving?.mode === 'withdraw' ? 'Withdraw' : 'Add money'}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setMoving(null)}>
              Cancel
            </button>
            <button type="submit" form="move-form" className="btn btn--primary">
              {moving?.mode === 'withdraw' ? 'Withdraw' : 'Add'}
            </button>
          </>
        }
      >
        {moving && (
          <MoveMoneyForm
            key={moving.goal.id}
            goal={moving.goal}
            mode={moving.mode}
            onModeChange={(mode) => setMoving((m) => ({ ...m, mode }))}
            onSubmit={moveMoney}
          />
        )}
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
