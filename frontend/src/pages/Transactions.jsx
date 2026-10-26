import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Modal from '../components/Modal.jsx';
import Money from '../components/Money.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useCategories } from '../lib/categories.js';
import { createTx, deleteTx, exportCsv, fetchTransactions, updateTx } from '../lib/data.js';
import { formatDate, formatDay } from '../lib/format.js';
import { invalidate, useResource } from '../lib/useResource.js';
import { LIMITS, PAYMENT_METHODS, fieldErrorsFrom, paymentLabel } from '../lib/validate.js';
import TransactionForm from './TransactionForm.jsx';
import { ConfirmDelete, ErrorNote } from './shared.jsx';
import './Transactions.css';

const LIMIT = 20;
const FILTER_KEYS = ['type', 'q', 'category', 'payment_method', 'source', 'startDate', 'endDate'];
const TX_FIELDS = ['amount', 'description', 'category', 'date', 'type', 'payment_method', 'notes'];
const label = (r) => r.description || r.category || 'this entry';

export default function Transactions() {
  const notify = useToast();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || '']));
  const query = { ...filters, page, limit: LIMIT };
  const queryKey = JSON.stringify(query);

  const list = useResource((s) => fetchTransactions(query, s), { keys: ['transactions'], deps: [queryKey] });
  const rows = list.data?.rows || [];
  const pg = list.data?.pagination;

  const [categoryDraft, setCategoryDraft] = useState(filters.category);
  const [searchDraft, setSearchDraft] = useState(filters.q);
  const [exporting, setExporting] = useState(false);
  const usedCategories = useCategories();
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [draft, setDraft] = useState(null); // values to restore after a failed save
  const [confirm, setConfirm] = useState(null);

  // ?new=1 (from the Dashboard) opens the drawer once.
  useEffect(() => {
    if (params.get('new')) {
      setEditing('new');
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (searchDraft === filters.q) return undefined;
    const t = setTimeout(() => updateFilter('q', searchDraft.trim()), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft]);

  useEffect(() => {
    if (categoryDraft === filters.category) return undefined;
    const t = setTimeout(() => updateFilter('category', categoryDraft), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryDraft]);

  function updateFilter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next, { replace: true });
  }

  function goTo(p) {
    const next = new URLSearchParams(params);
    if (p > 1) next.set('page', String(p));
    else next.delete('page');
    setParams(next);
  }

  function clearFilters() {
    setCategoryDraft('');
    setSearchDraft('');
    setParams(new URLSearchParams(), { replace: true });
  }

  const hasFilters = FILTER_KEYS.some((k) => filters[k]);
  const categories = useMemo(() => {
    const seen = new Set(usedCategories.map((c) => `${c.type}|${c.category}`));
    const extra = rows
      .filter((r) => r.category && !seen.has(`${r.type}|${r.category}`))
      .map((r) => ({ category: r.category, type: r.type, count: 0 }));
    return [...usedCategories, ...extra];
  }, [rows, usedCategories]);

  async function runExport() {
    setExporting(true);
    try {
      await exportCsv({ startDate: filters.startDate || undefined, endDate: filters.endDate || undefined });
    } catch (err) {
      notify(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          acc[r.type === 'income' ? 'income' : 'expense'] += r.amount;
          return acc;
        },
        { income: 0, expense: 0 }
      ),
    [rows]
  );

  async function save(payload) {
    const isNew = editing === 'new';
    const before = list.data;
    const target = isNew ? null : editing;
    setEditing(null);
    if (isNew) {
      const temp = { ...payload, id: `pending-${Date.now()}`, pending: true };
      if (page === 1) list.setData((d) => d && { ...d, rows: [temp, ...d.rows].slice(0, LIMIT) });
    } else {
      list.setData((d) => d && { ...d, rows: d.rows.map((r) => (r.id === target.id ? { ...r, ...payload, pending: true } : r)) });
    }
    try {
      if (isNew) await createTx(payload);
      else await updateTx(target.id, payload);
      invalidate('transactions', 'budgets', 'summary', 'categories');
    } catch (err) {
      list.setData(before);
      const errors = err.status === 400 ? fieldErrorsFrom(err, TX_FIELDS) : {};
      setDraft({ mode: isNew ? 'new' : target, values: payload, errors });
      if (Object.keys(errors).length) {
        setEditing(isNew ? 'new' : { ...target, ...payload });
        return;
      }
      notify(`Not saved: ${err.message}`, {
        action: { label: 'Reopen', onClick: () => setEditing(isNew ? 'new' : { ...target, ...payload }) },
      });
    }
  }

  async function remove(row) {
    const before = list.data;
    setConfirm(null);
    list.setData((d) => d && { ...d, rows: d.rows.filter((r) => r.id !== row.id) });
    try {
      await deleteTx(row.id);
      invalidate('transactions', 'budgets', 'summary');
    } catch (err) {
      list.setData(before);
      notify(`Could not delete "${label(row)}": ${err.message}`);
    }
  }

  const formInitial = editing && editing !== 'new' ? editing : draft?.mode === 'new' && editing === 'new' ? draft.values : null;

  return (
    <div className="page txpage">
      <header className="page__head">
        <div>
          <h1 className="page__title">Transactions</h1>
          <p className="page__lede">
            {pg ? `${pg.total} ${pg.total === 1 ? 'entry' : 'entries'}${hasFilters ? ' match these filters' : ' in the ledger'}.` : 'Every entry, newest first.'}
          </p>
        </div>
        <div className="page__actions">
          <button type="button" className="btn" onClick={runExport} disabled={exporting}>
            <Icon name="export" size={18} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <Link to="/import" className="btn">
            <Icon name="import" size={18} />
            Import statement
          </Link>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setDraft(null);
              setEditing('new');
            }}
          >
            <Icon name="plus" size={18} />
            Add entry
          </button>
        </div>
      </header>

      <form className="filters" role="search" aria-label="Filter transactions" onSubmit={(e) => e.preventDefault()}>
        <fieldset className="filters__type">
          <legend className="visually-hidden">Type</legend>
          <div className="seg">
            {[
              ['', 'All'],
              ['income', 'Income'],
              ['expense', 'Spending'],
            ].map(([v, label]) => (
              <label key={label} className="seg__opt">
                <input
                  type="radio"
                  name="filter-type"
                  value={v}
                  checked={filters.type === v}
                  onChange={() => updateFilter('type', v)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="field filters__q">
          <label className="field__label" htmlFor="f-q">
            Search
          </label>
          <input
            id="f-q"
            className="input"
            type="search"
            placeholder="Description or notes"
            maxLength={LIMITS.search}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
          />
        </div>
        <div className="field filters__cat">
          <label className="field__label" htmlFor="f-category">
            Category
          </label>
          <input
            id="f-category"
            className="input"
            type="search"
            placeholder="Any"
            maxLength={LIMITS.category}
            value={categoryDraft}
            onChange={(e) => setCategoryDraft(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-method">
            Paid by
          </label>
          <select id="f-method" className="input" value={filters.payment_method} onChange={(e) => updateFilter('payment_method', e.target.value)}>
            <option value="">Any method</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-source">
            Source
          </label>
          <select id="f-source" className="input" value={filters.source} onChange={(e) => updateFilter('source', e.target.value)}>
            <option value="">All sources</option>
            <option value="manual">Manual</option>
            <option value="import">Imported</option>
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-from">
            From
          </label>
          <input
            id="f-from"
            className="input"
            type="date"
            value={filters.startDate}
            max={filters.endDate || undefined}
            onChange={(e) => updateFilter('startDate', e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="f-to">
            To
          </label>
          <input
            id="f-to"
            className="input"
            type="date"
            value={filters.endDate}
            min={filters.startDate || undefined}
            onChange={(e) => updateFilter('endDate', e.target.value)}
          />
        </div>
        {hasFilters && (
          <button type="button" className="link-btn filters__clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </form>

      <ErrorNote error={list.error} onRetry={() => list.refetch()} />

      {list.loading && !list.data && (
        <div className="ledger-skeleton" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="skeleton" />
          ))}
        </div>
      )}

      {list.data && rows.length === 0 && (
        <div className="empty">
          {hasFilters ? (
            <>
              <p className="empty__title">Nothing matches</p>
              <p>No entries fit these filters. Widen the dates, change the search or clear the filters.</p>
              <button type="button" className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="empty__title">The ledger is empty</p>
              <p>Add your first income or expense, or import a bank or UPI statement. The dashboard, budgets and charts fill in from here.</p>
              <div className="empty__actions">
                <button type="button" className="btn btn--primary" onClick={() => setEditing('new')}>
                  Add first entry
                </button>
                <Link to="/import" className="btn">
                  Import statement
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className={`ledger-wrap${list.loading ? ' is-refreshing' : ''}`} aria-busy={list.loading}>
          <table className="ledger">
            <caption className="visually-hidden">
              Transactions, page {pg?.page || page} of {pg?.totalPages || 1}
            </caption>
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
                <th scope="col" className="ledger__act">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={r.pending ? 'is-pending' : undefined}>
                  <td className="ledger__date num">
                    <time dateTime={r.date} title={formatDate(r.date)}>
                      {formatDay(r.date)}
                    </time>
                  </td>
                  <td className="ledger__desc">
                    <span className="ledger__desc-text">{r.description || r.category}</span>
                    <span className="ledger__tags">
                      <span className="ledger__meta-mobile">
                        {formatDay(r.date)} · {r.category} ·{' '}
                      </span>
                      <span className="ledger__method">{paymentLabel(r.payment_method)}</span>
                      {r.source === 'import' && <span className="tag">Imported</span>}
                    </span>
                  </td>
                  <td className="ledger__cat">{r.category}</td>
                  <td className="ledger__amt">
                    <Money amount={r.amount} type={r.type} signed />
                  </td>
                  <td className="ledger__act">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => {
                        setDraft(null);
                        setEditing(r);
                      }}
                      disabled={r.pending}
                      aria-label={`Edit ${label(r)}`}
                    >
                      <Icon name="edit" size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => setConfirm(r)}
                      disabled={r.pending}
                      aria-label={`Delete ${label(r)}`}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ledger-total">
            <dt>This page</dt>
            <dd>
              <span className="ledger-total__label">In</span>
              <Money amount={totals.income} type="income" size="sm" />
            </dd>
            <dd>
              <span className="ledger-total__label">Out</span>
              <Money amount={totals.expense} type="expense" size="sm" />
            </dd>
          </dl>
        </div>
      )}

      {pg && pg.totalPages > 1 && (
        <nav className="pager" aria-label="Pages">
          <button type="button" className="btn" onClick={() => goTo(page - 1)} disabled={page <= 1}>
            <Icon name="left" size={18} />
            Newer
          </button>
          <span className="pager__pos num">
            Page {pg.page} of {pg.totalPages}
          </span>
          <button type="button" className="btn" onClick={() => goTo(page + 1)} disabled={page >= pg.totalPages}>
            Older
            <Icon name="right" size={18} />
          </button>
        </nav>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New entry' : 'Edit entry'}
        footer={
          <>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="tx-form" className="btn btn--primary">
              {editing === 'new' ? 'Add entry' : 'Save changes'}
            </button>
          </>
        }
      >
        {editing && (
          <TransactionForm
            key={editing === 'new' ? 'new' : editing.id}
            initial={formInitial}
            initialErrors={draft?.errors}
            categories={categories}
            onSubmit={save}
          />
        )}
      </Modal>

      <ConfirmDelete
        open={Boolean(confirm)}
        title="Delete this entry?"
        body={confirm ? `"${label(confirm)}" will be removed from the ledger and from every total. This cannot be undone.` : ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => remove(confirm)}
      />
    </div>
  );
}
