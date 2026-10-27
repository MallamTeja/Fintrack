import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Money from '../components/Money.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { PAYEE_NAME_MAX, fetchPayee, fetchPayees, payeePath, renamePayee } from '../lib/data.js';
import { formatDate, formatDay } from '../lib/format.js';
import { invalidate, useResource } from '../lib/useResource.js';
import { ErrorNote } from './shared.jsx';
import './Plans.css';
import './People.css';
import './Transactions.css';

const plural = (n, one, many) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const handleOf = (p) => p.upi_id || (p.key.startsWith('upi:') ? `${p.key.slice(4)}@…` : '');

export function People() {
  const list = useResource((signal) => fetchPayees(signal), { keys: ['transactions', 'payees'] });
  const [q, setQ] = useState('');
  const searchId = useId();
  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = list.data || [];
    if (!needle) return all;
    return all.filter((p) => p.name.toLowerCase().includes(needle) || handleOf(p).toLowerCase().includes(needle));
  }, [list.data, q]);

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1 className="page__title">People</h1>
          <p className="page__lede">
            Everyone your money goes to or comes from, grouped by UPI ID. Give someone their full name once and every entry with them,
            past and future, uses it.
          </p>
        </div>
      </header>

      <ErrorNote error={list.error} onRetry={list.refetch} />
      {list.loading && !list.data && <span className="skeleton people-skeleton" />}

      {list.data && list.data.length === 0 && (
        <div className="empty">
          <p className="empty__title">No people yet</p>
          <p>People appear here when you import a bank or UPI statement. Each UPI ID becomes one person or business.</p>
          <Link to="/import" className="btn btn--primary">
            Import a statement
          </Link>
        </div>
      )}

      {list.data && list.data.length > 0 && (
        <>
          <div className="people-search field">
            <label className="field__label" htmlFor={searchId}>
              Search
            </label>
            <input
              id={searchId}
              className="input"
              type="search"
              value={q}
              maxLength={100}
              placeholder="Name or UPI ID"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <p className="muted people-count" aria-live="polite">
            {q ? `${plural(people.length, 'match', 'matches')} of ${list.data.length}` : plural(list.data.length, 'person or business', 'people and businesses')}
          </p>
          <ul className="people">
            {people.map((p) => (
              <li key={p.key}>
                <Link to={payeePath(p.key)} className="person-row">
                  <span className="person-row__who">
                    <span className="person-row__name">{p.name}</span>
                    <span className="person-row__meta">
                      {handleOf(p) && <span className="num">{handleOf(p)}</span>}
                      <span>
                        {plural(p.count, 'entry', 'entries')} · last {formatDay(p.last_date)}
                      </span>
                    </span>
                  </span>
                  <span className="person-row__money">
                    {p.received > 0 && <Money amount={p.received} type="income" signed size="sm" />}
                    {p.paid > 0 && <Money amount={p.paid} type="expense" signed size="sm" />}
                  </span>
                  <Icon name="right" size={18} />
                </Link>
              </li>
            ))}
          </ul>
          {people.length === 0 && <p className="muted">Nobody matches "{q}".</p>}
        </>
      )}
    </div>
  );
}

function RenameForm({ payee, onSaved }) {
  const notify = useToast();
  const id = useId();
  const [name, setName] = useState(payee.name);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(payee.name), [payee.name]);

  const trimmed = name.trim();
  const unchanged = trimmed === payee.name;

  const submit = async (e) => {
    e.preventDefault();
    if (!trimmed) return setError('Enter a name.');
    if (trimmed.length > PAYEE_NAME_MAX) return setError(`Keep it to ${PAYEE_NAME_MAX} characters.`);
    setBusy(true);
    setError('');
    try {
      const res = await renamePayee(payee.key, trimmed);
      notify(`Renamed ${plural(res.updated, 'entry', 'entries')} to ${res.name}.`);
      invalidate('transactions', 'payees');
      onSaved?.();
    } catch (err) {
      setError(err.message || 'Could not save the name. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="rename" onSubmit={submit} noValidate>
      <div className="field">
        <div className="field__row">
          <label className="field__label" htmlFor={id}>
            Full name
          </label>
          <span className={`field__count${name.length > PAYEE_NAME_MAX ? ' is-over' : ''}`}>
            {name.length}/{PAYEE_NAME_MAX}
          </span>
        </div>
        <div className="rename__row">
          <input
            id={id}
            className="input"
            value={name}
            maxLength={PAYEE_NAME_MAX + 20}
            autoComplete="off"
            aria-invalid={Boolean(error)}
            aria-describedby={`${id}-hint${error ? ` ${id}-err` : ''}`}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
          />
          <button type="submit" className="btn btn--primary" disabled={busy || unchanged}>
            {busy ? 'Saving…' : 'Save name'}
          </button>
        </div>
        <p id={`${id}-hint`} className="field__hint">
          Statements shorten names. The name you save replaces it on all {plural(payee.count, 'entry', 'entries')} and on future imports.
        </p>
        {error && (
          <p id={`${id}-err`} className="field__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

export function Person() {
  const { key: raw } = useParams();
  const key = raw ? decodeURIComponent(raw) : '';
  const detail = useResource((signal) => fetchPayee(key, signal), { keys: ['transactions', 'payees'], deps: [key] });

  if (detail.error?.status === 404 || detail.error?.status === 400) {
    return (
      <div className="page">
        <div className="empty">
          <p className="empty__title">Nobody here</p>
          <p>There are no entries for this person any more. They may have been deleted.</p>
          <Link to="/people" className="btn btn--primary">
            See all people
          </Link>
        </div>
      </div>
    );
  }
  const p = detail.data?.payee;
  const rows = detail.data?.transactions || [];
  const net = p ? Math.round((p.received - p.paid) * 100) / 100 : 0;

  return (
    <div className="page">
      <Link to="/people" className="back-link">
        <Icon name="left" size={18} />
        All people
      </Link>
      <ErrorNote error={detail.error} onRetry={detail.refetch} />
      {detail.loading && !p && <span className="skeleton people-skeleton" />}
      {p && (
        <>
          <header className="page__head">
            <div>
              <h1 className="page__title">{p.name}</h1>
              {handleOf(p) && (
                <p className="page__lede num">
                  UPI ID {handleOf(p)}
                </p>
              )}
            </div>
          </header>

          <RenameForm payee={p} />

          <dl className="plan-sum person-sum">
            <div>
              <dt>Received</dt>
              <dd>
                <Money amount={p.received} type={p.received ? 'income' : undefined} />
              </dd>
            </div>
            <div>
              <dt>Paid</dt>
              <dd>
                <Money amount={p.paid} type={p.paid ? 'expense' : undefined} />
              </dd>
            </div>
            <div>
              <dt>Net</dt>
              <dd>
                <Money amount={Math.abs(net)} type={net > 0 ? 'income' : net < 0 ? 'expense' : undefined} signed />
              </dd>
            </div>
            <div>
              <dt>Since</dt>
              <dd className="num">{formatDate(p.first_date)}</dd>
            </div>
          </dl>

          <section className="section" aria-labelledby="person-entries">
            <div className="section__head">
              <h2 className="section__title" id="person-entries">
                {plural(rows.length, 'entry', 'entries')}
              </h2>
            </div>
            <div className="ledger-wrap">
              <table className="ledger">
                <thead>
                  <tr>
                    <th scope="col" className="ledger__date">
                      Date
                    </th>
                    <th scope="col">Description</th>
                    <th scope="col" className="ledger__cat">
                      Category
                    </th>
                    <th scope="col" className="ledger__amt">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="ledger__date num">
                        <time dateTime={r.date} title={formatDate(r.date)}>
                          {formatDay(r.date)}
                        </time>
                      </td>
                      <td className="ledger__desc">
                        <span className="ledger__desc-text">{r.description || r.category}</span>
                        {r.notes && <span className="ledger__tags person-note">{r.notes}</span>}
                      </td>
                      <td className="ledger__cat">{r.category}</td>
                      <td className="ledger__amt">
                        <Money amount={r.amount} type={r.type} signed />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
