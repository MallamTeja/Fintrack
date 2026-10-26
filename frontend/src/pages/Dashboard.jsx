import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Money from '../components/Money.jsx';
import { CashFlowChart, CategoryBars, Meter, PaceChart, SpendHeatmap } from '../components/Charts.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useResource } from '../lib/useResource.js';
import { fetchAllTransactions, fetchBudgets, fetchGoals, fetchTransactions } from '../lib/data.js';
import {
  PERIODS,
  biggestCategoryChange,
  budgetHealth,
  byCategory,
  cumulativePace,
  dailyHeatmap,
  goalPlan,
  inWindow,
  largestExpense,
  monthBuckets,
  pctChange,
  periodWindows,
  projectMonthEnd,
  topN,
  totals,
} from '../lib/analytics.js';
import { formatDate, formatDay, formatMoney, formatMonth, monthRange, parseDay } from '../lib/format.js';
import { ErrorNote } from './shared.jsx';
import './Dashboard.css';

const MAX_PAGES = 10;
const PAGE_SIZE = 500;

/**
 * Transactions for the trailing 13 months (trends plus the 1 and 3 month comparisons),
 * and the 12 months before that only when the 12 month period needs a comparison.
 */
function useDashboardData(today, needOlder) {
  const recentRange = { startDate: monthRange(today, -12).startDate, endDate: monthRange(today).endDate };
  const olderRange = { startDate: monthRange(today, -24).startDate, endDate: monthRange(today, -13).endDate };
  const tx = useResource((s) => fetchAllTransactions({ ...recentRange, limit: PAGE_SIZE, maxPages: MAX_PAGES }, s), {
    keys: ['transactions'],
  });
  const older = useResource(
    (s) =>
      needOlder
        ? fetchAllTransactions({ ...olderRange, limit: PAGE_SIZE, maxPages: MAX_PAGES }, s)
        : Promise.resolve(null),
    { keys: ['transactions'], deps: [needOlder] }
  );
  const recent = useResource((s) => fetchTransactions({ page: 1, limit: 8 }, s), { keys: ['transactions'] });
  const budgets = useResource(fetchBudgets, { keys: ['budgets', 'transactions'] });
  const goals = useResource(fetchGoals, { keys: ['savings'] });
  return { tx, older, recent, budgets, goals };
}

const dm = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
function rangeLabel(w) {
  const sameYear = w.start.getFullYear() === w.end.getFullYear();
  return `${sameYear ? dm.format(w.start) : formatDate(w.start)} to ${formatDate(w.end)}`;
}

const whole = (v, currency) => formatMoney(v, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Change against the previous period. good: 'up' | 'down' | null decides the colour
 * (more income is green, more spending is brick, neutral counts stay muted).
 */
function Delta({ cur, prev, kind = 'pct', good = null, currency, pending }) {
  if (pending) return <span className="skeleton kpi__delta-skel" />;
  if (prev == null || cur == null) {
    return <span className="kpi__delta is-flat">No comparison</span>;
  }
  const diff = cur - prev;
  let text;
  let spoken;
  if (kind === 'pct') {
    const pct = pctChange(cur, prev);
    if (pct == null) {
      return <span className="kpi__delta is-flat">{cur === 0 ? 'None either period' : 'None last period'}</span>;
    }
    const r = Math.abs(pct) < 10 ? Math.abs(pct).toFixed(1) : Math.round(Math.abs(pct));
    text = `${r}%`;
    spoken = `${r} percent`;
  } else if (kind === 'points') {
    const r = Math.abs(diff).toFixed(1);
    text = `${r} pts`;
    spoken = `${r} percentage points`;
  } else if (kind === 'money') {
    text = whole(Math.abs(diff), currency);
    spoken = text;
  } else {
    text = String(Math.abs(diff));
    spoken = text;
  }
  if (Math.abs(diff) < 1e-9 || text === '0.0%' || text === '0.0 pts') {
    return <span className="kpi__delta is-flat">No change</span>;
  }
  const up = diff > 0;
  const tone = good == null ? 'is-flat' : (up && good === 'up') || (!up && good === 'down') ? 'is-in' : 'is-out';
  return (
    <span className={`kpi__delta ${tone}`}>
      <span aria-hidden="true">
        <span className="kpi__arrow">{up ? '▲' : '▼'}</span>
        {text}
      </span>
      <span className="visually-hidden">
        {up ? 'Up' : 'Down'} {spoken} on the previous period
      </span>
    </span>
  );
}

function Kpi({ label, children, delta, note }) {
  return (
    <div className="kpi">
      <dt className="dash-label">{label}</dt>
      <dd className="kpi__value">{children}</dd>
      <dd className="kpi__foot">
        {delta}
        {note && <span className="kpi__note">{note}</span>}
      </dd>
    </div>
  );
}

function Rate({ value }) {
  if (value == null) return <span className="kpi__fig kpi__fig--na">n/a</span>;
  const r = Math.round(value);
  return (
    <span className="kpi__fig num">
      {r < 0 ? '−' : ''}
      {Math.abs(r)}
      <span className="kpi__unit">%</span>
    </span>
  );
}

function SectionHead({ id, title, aside, link }) {
  return (
    <div className="section__head">
      <h2 id={id} className="section__title">
        {title}
      </h2>
      {aside && <span className="dash-aside">{aside}</span>}
      {link}
    </div>
  );
}

function PeriodControl({ value, onChange }) {
  return (
    <fieldset className="dash-period">
      <legend className="visually-hidden">Period for figures and breakdowns</legend>
      <div className="seg">
        {PERIODS.map((p) => (
          <label key={p.id} className="seg__opt">
            <input
              type="radio"
              name="dash-period"
              value={p.id}
              aria-label={p.label}
              checked={value === p.id}
              onChange={() => onChange(p.id)}
            />
            <span>
              <span className="dash-period__long">{p.label}</span>
              <span className="dash-period__short" aria-hidden="true">
                {p.short}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const Skel = ({ h = 160 }) => <span className="skeleton dash-skel" style={{ height: h }} />;

export default function Dashboard() {
  const { currency } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [params, setParams] = useSearchParams();
  const period = PERIODS.some((p) => p.id === params.get('period')) ? params.get('period') : 'month';
  const setPeriod = (id) => {
    const next = new URLSearchParams(params);
    if (id === 'month') next.delete('period');
    else next.set('period', id);
    setParams(next, { replace: true });
  };

  const { tx, older, recent, budgets, goals } = useDashboardData(today, period === '12m');
  const rows = tx.data?.rows;
  const periodLabel = PERIODS.find((p) => p.id === period).label;

  const a = useMemo(() => {
    if (!rows) return null;
    const win = periodWindows(period, today);
    const prevReady = period !== '12m' || Boolean(older.data);
    const all = older.data ? rows.concat(older.data.rows) : rows;
    const curRows = inWindow(rows, win.current);
    const prevRows = prevReady ? inWindow(all, win.previous) : [];
    const months = monthBuckets(rows, today, 12);
    const yearIncome = months.reduce((s, m) => s + m.income, 0);
    const yearExpense = months.reduce((s, m) => s + m.expense, 0);
    return {
      win,
      prevReady,
      cur: totals(curRows, win.current.days),
      prev: prevReady ? totals(prevRows, win.previous.days) : null,
      months,
      yearRate: yearIncome > 0 ? ((yearIncome - yearExpense) / yearIncome) * 100 : null,
      spend: topN(byCategory(curRows, 'expense'), 6),
      income: topN(byCategory(curRows, 'income'), 4),
      pace: cumulativePace(rows, today),
      heat: dailyHeatmap(rows, today, 12),
      change: prevReady ? biggestCategoryChange(curRows, prevRows) : null,
      largest: largestExpense(curRows),
    };
  }, [rows, older.data, period, today]);

  const health = useMemo(() => budgetHealth(budgets.data), [budgets.data]);
  const isEmpty = rows && rows.length === 0 && recent.data && recent.data.rows.length === 0;
  const loadingTx = tx.loading && !rows;

  return (
    <div className="page dash">
      <header className="page__head">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="page__lede">
            <span className="dash-month">{formatMonth(today)}</span>, figures up to {formatDate(today)}.
          </p>
        </div>
        {!isEmpty && (
          <Link to="/transactions?new=1" className="btn btn--primary">
            Add entry
          </Link>
        )}
      </header>

      {isEmpty ? (
        <section className="empty dash-empty" aria-labelledby="dash-empty">
          <h2 id="dash-empty" className="empty__title">
            Your ledger is empty
          </h2>
          <p>
            Record a salary, a rent payment or a coffee. Cash flow, categories, pace and insights are worked out from
            your entries, so this page fills in as soon as the first one lands.
          </p>
          <Link to="/transactions?new=1" className="btn btn--primary">
            Add your first entry
          </Link>
        </section>
      ) : (
        <>
          <div className="dash-bar">
            <PeriodControl value={period} onChange={setPeriod} />
            {a && (
              <p className="dash-compare">
                {rangeLabel(a.win.current)}
                <span className="muted">, compared with {rangeLabel(a.win.previous)}</span>
              </p>
            )}
          </div>

          {tx.error && !rows ? (
            <div className="dash-error">
              <ErrorNote error={tx.error} onRetry={() => tx.refetch()} />
            </div>
          ) : (
            <section aria-labelledby="dash-kpis" className="dash-kpis">
              <h2 id="dash-kpis" className="visually-hidden">
                Key figures, {periodLabel.toLowerCase()}
              </h2>
              <dl className="kpis">
                <Kpi
                  label="Income"
                  delta={<Delta cur={a?.cur.income} prev={a?.prev?.income} good="up" pending={!a || !a.prevReady} />}
                >
                  {a ? (
                    <Money amount={a.cur.income} size="lg" decimals={false} />
                  ) : (
                    <span className="skeleton kpi__skel" />
                  )}
                </Kpi>
                <Kpi
                  label="Spending"
                  delta={
                    <Delta cur={a?.cur.expense} prev={a?.prev?.expense} good="down" pending={!a || !a.prevReady} />
                  }
                >
                  {a ? (
                    <Money amount={a.cur.expense} size="lg" decimals={false} />
                  ) : (
                    <span className="skeleton kpi__skel" />
                  )}
                </Kpi>
                <Kpi
                  label="Net saved"
                  delta={
                    <Delta
                      cur={a?.cur.net}
                      prev={a?.prev?.net}
                      kind="money"
                      good="up"
                      currency={currency}
                      pending={!a || !a.prevReady}
                    />
                  }
                >
                  {a ? (
                    <Money amount={a.cur.net} size="lg" decimals={false} />
                  ) : (
                    <span className="skeleton kpi__skel" />
                  )}
                </Kpi>
                <Kpi
                  label="Savings rate"
                  delta={
                    <Delta
                      cur={a?.cur.savingsRate}
                      prev={a?.prev?.savingsRate}
                      kind="points"
                      good="up"
                      pending={!a || !a.prevReady}
                    />
                  }
                  note={a && a.cur.savingsRate == null ? 'No income this period' : 'Share of income kept'}
                >
                  {a ? <Rate value={a.cur.savingsRate} /> : <span className="skeleton kpi__skel" />}
                </Kpi>
                <Kpi
                  label="Average daily spend"
                  delta={
                    <Delta
                      cur={a?.cur.dailySpend}
                      prev={a?.prev?.dailySpend}
                      good="down"
                      pending={!a || !a.prevReady}
                    />
                  }
                  note={a ? `Over ${a.win.current.days} ${a.win.current.days === 1 ? 'day' : 'days'}` : null}
                >
                  {a ? (
                    <Money amount={a.cur.dailySpend} size="lg" decimals={false} />
                  ) : (
                    <span className="skeleton kpi__skel" />
                  )}
                </Kpi>
                <Kpi
                  label="Entries"
                  delta={<Delta cur={a?.cur.count} prev={a?.prev?.count} kind="count" pending={!a || !a.prevReady} />}
                >
                  {a ? <span className="kpi__fig num">{a.cur.count}</span> : <span className="skeleton kpi__skel" />}
                </Kpi>
              </dl>
              {older.error && period === '12m' && <ErrorNote error={older.error} onRetry={() => older.refetch()} />}
              {(tx.data?.truncated || older.data?.truncated) && (
                <p className="muted dash-note">
                  This range has more than {(MAX_PAGES * PAGE_SIZE).toLocaleString('en-IN')} entries. Figures use the
                  first {(MAX_PAGES * PAGE_SIZE).toLocaleString('en-IN')} and may be incomplete.
                </p>
              )}
            </section>
          )}

          <div className="dash-grid">
            {!(tx.error && !rows) && (
              <>
                <section className="section dash-cell dash-cell--12" aria-labelledby="dash-flow">
                  <SectionHead
                    id="dash-flow"
                    title="Cash flow"
                    aside={
                      a
                        ? `${a.months[0].label} ${a.months[0].year} to ${a.months[11].label} ${a.months[11].year}`
                        : 'Last 12 months'
                    }
                  />
                  {loadingTx ? <Skel h={280} /> : <CashFlowChart months={a.months} currency={currency} />}
                  {a && a.yearRate != null && (
                    <p className="dash-sub">
                      Over these 12 months you kept <strong className="num">{Math.round(a.yearRate)}%</strong> of what
                      came in.
                    </p>
                  )}
                </section>

                <section className="section dash-cell dash-cell--5" aria-labelledby="dash-cats">
                  <SectionHead id="dash-cats" title="Where it went" aside={periodLabel} />
                  {loadingTx && <Skel h={240} />}
                  {a && a.spend.length === 0 && <p className="muted dash-note">No spending recorded in this period.</p>}
                  {a && a.spend.length > 0 && (
                    <>
                      <p className="dash-sub">
                        <Money amount={a.cur.expense} size="sm" decimals={false} /> across {byCategoryCount(a.spend)}{' '}
                        {byCategoryCount(a.spend) === 1 ? 'category' : 'categories'}.
                      </p>
                      <CategoryBars rows={a.spend} currency={currency} />
                    </>
                  )}
                </section>

                <section className="section dash-cell dash-cell--7 dash-cell--ruled" aria-labelledby="dash-pace">
                  <SectionHead
                    id="dash-pace"
                    title="Spending pace"
                    aside={a ? `${a.pace.currentLabel} against ${a.pace.previousLabel}` : null}
                  />
                  {loadingTx ? <Skel h={220} /> : <PaceLead pace={a.pace} currency={currency} />}
                  {a && <PaceChart pace={a.pace} currency={currency} />}
                </section>

                <section className="section dash-cell dash-cell--7" aria-labelledby="dash-heat">
                  <SectionHead id="dash-heat" title="Daily spending" aside="Last 12 weeks" />
                  {loadingTx ? (
                    <Skel h={200} />
                  ) : (
                    <>
                      <p className="dash-sub">
                        Money went out on <strong className="num">{a.heat.spendDays}</strong> of {a.heat.days} days.
                        {a.heat.max && (
                          <>
                            {' '}
                            The heaviest was {a.heat.max.label}, at{' '}
                            <Money amount={a.heat.max.value} size="sm" decimals={false} />.
                          </>
                        )}
                      </p>
                      <SpendHeatmap heat={a.heat} currency={currency} />
                    </>
                  )}
                </section>

                <section className="section dash-cell dash-cell--5 dash-cell--ruled" aria-labelledby="dash-income">
                  <SectionHead id="dash-income" title="Where it came from" aside={periodLabel} />
                  {loadingTx && <Skel h={160} />}
                  {a && a.income.length === 0 && <p className="muted dash-note">No income recorded in this period.</p>}
                  {a && a.income.length > 0 && (
                    <>
                      <CategoryBars rows={a.income} currency={currency} tone="in" noun="income" />
                      <IncomeSplit income={a.cur.income} expense={a.cur.expense} currency={currency} />
                    </>
                  )}
                </section>
              </>
            )}

            <section className="section dash-cell dash-cell--6" aria-labelledby="dash-budgets">
              <SectionHead
                id="dash-budgets"
                title="Budget health"
                aside="This month"
                link={
                  <Link to="/budgets" className="section__link">
                    Budgets
                  </Link>
                }
              />
              <ErrorNote error={budgets.error} onRetry={() => budgets.refetch()} />
              {budgets.loading && !budgets.data && <Skel h={160} />}
              {budgets.data && budgets.data.length === 0 && (
                <p className="muted dash-note">
                  No budgets yet. <Link to="/budgets">Set a monthly limit</Link> for a category you want to watch.
                </p>
              )}
              {health.length > 0 && (
                <ul className="health">
                  {health.map((b) => (
                    <li key={b.id} className="health__row">
                      <div className="health__top">
                        <span className="health__cat">{b.category}</span>
                        <span
                          className={`health__state ${b.state === 'over' ? 'is-out' : b.state === 'near' ? 'is-warn' : 'muted'}`}
                        >
                          {b.state === 'over' ? `Over by ${whole(b.over, currency)}` : `${Math.round(b.pct)}% used`}
                        </span>
                      </div>
                      <Meter value={b.current_spending} max={b.limit} label={`${b.category} budget used`} />
                      <span className="health__meta num">
                        {whole(b.current_spending, currency)} of {whole(b.limit, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="section dash-cell dash-cell--6 dash-cell--ruled" aria-labelledby="dash-goals">
              <SectionHead
                id="dash-goals"
                title="Savings goals"
                link={
                  <Link to="/savings" className="section__link">
                    Goals
                  </Link>
                }
              />
              <ErrorNote error={goals.error} onRetry={() => goals.refetch()} />
              {goals.loading && !goals.data && <Skel h={160} />}
              {goals.data && goals.data.length === 0 && (
                <p className="muted dash-note">
                  No goals yet. <Link to="/savings">Start one</Link> for a deposit, a trip or three months of cushion.
                </p>
              )}
              {goals.data && goals.data.length > 0 && (
                <ul className="health">
                  {goals.data.map((g) => (
                    <GoalRow key={g.id} goal={g} today={today} currency={currency} />
                  ))}
                </ul>
              )}
            </section>

            {!(tx.error && !rows) && (
              <section className="section dash-cell dash-cell--5" aria-labelledby="dash-insights">
                <SectionHead id="dash-insights" title="Insights" aside={periodLabel} />
                {loadingTx ? <Skel h={200} /> : <Insights a={a} budgets={health} today={today} currency={currency} />}
              </section>
            )}

            <section className="section dash-cell dash-cell--7 dash-cell--ruled" aria-labelledby="dash-recent">
              <SectionHead
                id="dash-recent"
                title="Recent entries"
                link={
                  <Link to="/transactions" className="section__link">
                    All transactions
                  </Link>
                }
              />
              <ErrorNote error={recent.error} onRetry={() => recent.refetch()} />
              {recent.loading && !recent.data && <Skel h={240} />}
              {recent.data && recent.data.rows.length === 0 && <p className="muted dash-note">No entries yet.</p>}
              {recent.data && recent.data.rows.length > 0 && (
                <ul className="entries">
                  {recent.data.rows.map((t) => (
                    <li key={t.id} className="entries__row">
                      <span className="entries__date num">{formatDay(t.date)}</span>
                      <span className="entries__main">
                        <span className="entries__desc">{t.description}</span>
                        <span className="entries__cat">{t.category}</span>
                      </span>
                      <Money amount={t.amount} type={t.type} signed />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** One 100% bar: how much of the period's income went out again and how much stayed. */
function IncomeSplit({ income, expense, currency }) {
  const spentPct = Math.min(100, (expense / income) * 100);
  const keptPct = 100 - spentPct;
  const over = expense - income;
  return (
    <div className="split">
      <p className="dash-label">What happened to it</p>
      <svg
        className="split__bar"
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        role="img"
        aria-label={
          over > 0
            ? `Spending was ${whole(over, currency)} more than income.`
            : `${Math.round(spentPct)} percent of income was spent and ${Math.round(keptPct)} percent was kept.`
        }
      >
        <rect className="split__out" x="0" y="0" width={spentPct} height="10" />
        <rect className="split__kept" x={spentPct} y="0" width={keptPct} height="10" />
      </svg>
      <p className="split__legend">
        <span className="chart__key chart__key--out">
          <span>
            Spent <strong className="num">{Math.round(spentPct)}%</strong>
          </span>
        </span>
        {over > 0 ? (
          <span className="is-out">Over income by {whole(over, currency)}</span>
        ) : (
          <span className="chart__key chart__key--in">
            <span>
              Kept <strong className="num">{Math.round(keptPct)}%</strong>, {whole(income - expense, currency)}
            </span>
          </span>
        )}
      </p>
    </div>
  );
}

const byCategoryCount = (rows) => rows.reduce((n, r) => n + (r.other ? r.count : 1), 0);

function PaceLead({ pace, currency }) {
  const diff = pace.currentToDate - pace.previousToDate;
  return (
    <p className="dash-sub">
      By day {pace.today}: <Money amount={pace.currentToDate} size="sm" decimals={false} /> spent
      {pace.previousToDate > 0 || pace.currentToDate > 0 ? (
        <>
          ,{' '}
          {diff === 0 ? (
            <>exactly level with {pace.previousLabel}.</>
          ) : (
            <>
              <strong className={diff > 0 ? 'is-out' : 'is-in'}>
                {whole(Math.abs(diff), currency)} {diff > 0 ? 'more' : 'less'}
              </strong>{' '}
              than by the same day of {pace.previousLabel}.
            </>
          )}
        </>
      ) : (
        '.'
      )}
    </p>
  );
}

function GoalRow({ goal, today, currency }) {
  const plan = goalPlan(goal, today);
  let detail;
  if (plan.state === 'done') detail = 'Target reached';
  else if (plan.state === 'open') detail = `${whole(plan.left, currency)} to go, no due date set`;
  else if (plan.state === 'overdue') detail = `${whole(plan.left, currency)} to go, due date has passed`;
  else
    detail = (
      <>
        {whole(plan.left, currency)} to go. <strong className="num">{whole(plan.perMonth, currency)} a month</strong>{' '}
        reaches it by{' '}
        {new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(parseDay(goal.due_date))}
      </>
    );
  return (
    <li className="health__row">
      <div className="health__top">
        <span className="health__cat">{goal.title}</span>
        <span className="health__state num muted">{Math.round(plan.pct)}%</span>
      </div>
      <Meter value={goal.current_amount} max={goal.target_amount} label={`${goal.title} progress`} tone="goal" />
      <span className={`health__meta${plan.state === 'overdue' ? ' is-warn' : ''}`}>{detail}</span>
    </li>
  );
}

function Insights({ a, budgets, today, currency }) {
  const items = [];
  const m = (v) => <strong className="num">{whole(v, currency)}</strong>;

  if (a.change) {
    const c = a.change;
    items.push({
      key: 'change',
      label: 'Biggest shift',
      body:
        c.previous === 0 ? (
          <>
            {c.label} is new this period, at {m(c.current)}, with nothing in the previous one.
          </>
        ) : (
          <>
            {c.label} spending is{' '}
            <span className={c.diff > 0 ? 'is-out' : 'is-in'}>
              {c.diff > 0 ? 'up' : 'down'} {whole(Math.abs(c.diff), currency)}
              {c.pct != null && ` (${Math.round(Math.abs(c.pct))}%)`}
            </span>{' '}
            on the previous period, at {m(c.current)}.
          </>
        ),
    });
  }

  if (a.largest) {
    items.push({
      key: 'largest',
      label: 'Largest expense',
      body: (
        <>
          {a.largest.description || a.largest.category} ({a.largest.category}), {m(a.largest.amount)} on{' '}
          {formatDate(a.largest.date)}.
        </>
      ),
    });
  }

  const proj = projectMonthEnd(a.pace.currentToDate, today);
  const month = new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(today);
  items.push({
    key: 'pace',
    label: 'Month end',
    body:
      proj.daysLeft === 0 ? (
        <>
          Last day of {month}. Spending so far is {m(a.pace.currentToDate)}, against {m(a.pace.previousTotal)} in all of{' '}
          {a.pace.previousLabel}.
        </>
      ) : (
        <>
          {proj.daysLeft} {proj.daysLeft === 1 ? 'day' : 'days'} left in {month}. At {whole(proj.daily, currency)} a day
          so far, spending would reach about {m(proj.projected)}, against {m(a.pace.previousTotal)} in all of{' '}
          {a.pace.previousLabel}.
        </>
      ),
  });

  if (budgets.length) {
    const over = budgets.filter((b) => b.state === 'over').length;
    const near = budgets.filter((b) => b.state === 'near').length;
    items.push({
      key: 'budgets',
      label: 'Budgets',
      body:
        over + near === 0 ? (
          <>All {budgets.length} budgets are under 80% of their limit this month.</>
        ) : (
          <>
            {over > 0 && (
              <span className="is-out">
                {over} over {over === 1 ? 'its' : 'their'} limit
              </span>
            )}
            {over > 0 && near > 0 && ' and '}
            {near > 0 && <span className="is-warn">{near} at 80% or more</span>}, of {budgets.length} budgets this
            month.
          </>
        ),
    });
  }

  if (a.cur.savingsRate != null && a.yearRate != null) {
    const d = a.cur.savingsRate - a.yearRate;
    items.push({
      key: 'rate',
      label: 'Savings rate',
      body: (
        <>
          You kept <strong className="num">{Math.round(a.cur.savingsRate)}%</strong> of income in this period, against{' '}
          {Math.round(a.yearRate)}% over the last 12 months
          {Math.abs(d) >= 1 && (
            <>
              , <span className={d > 0 ? 'is-in' : 'is-out'}>{d > 0 ? 'better' : 'worse'} than usual</span>
            </>
          )}
          .
        </>
      ),
    });
  }

  return (
    <ul className="insights">
      {items.map((i) => (
        <li key={i.key} className="insights__row">
          <span className="dash-label">{i.label}</span>
          <p>{i.body}</p>
        </li>
      ))}
    </ul>
  );
}
