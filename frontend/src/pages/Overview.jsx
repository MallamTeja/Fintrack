import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Money from '../components/Money.jsx';
import { CategoryBars, Meter, TrendChart } from '../components/Charts.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useResource } from '../lib/useResource.js';
import { fetchBudgets, fetchGoals, fetchSummary, fetchTransactions, spendingByCategory } from '../lib/data.js';
import { formatDate, formatDay, formatMoney, formatMonth, formatShortMonth, monthKey, monthRange, percent } from '../lib/format.js';
import { ErrorNote } from './shared.jsx';
import './Overview.css';

function useOverviewData() {
  const now = new Date();
  const month = monthRange(now);
  const sixStart = monthRange(now, -5);

  const summary = useResource((s) => fetchSummary({ startDate: month.startDate, endDate: month.endDate }, s), {
    keys: ['transactions', 'summary'],
  });
  const history = useResource(
    (s) => fetchTransactions({ startDate: sixStart.startDate, endDate: month.endDate, limit: 500, page: 1 }, s),
    { keys: ['transactions'] }
  );
  const recent = useResource((s) => fetchTransactions({ page: 1, limit: 8 }, s), { keys: ['transactions'] });
  const budgets = useResource(fetchBudgets, { keys: ['budgets', 'transactions'] });
  const goals = useResource(fetchGoals, { keys: ['savings'] });
  return { now, month, summary, history, recent, budgets, goals };
}

function sixMonths(rows, now) {
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const { start } = monthRange(now, -i);
    const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
    months.push({ key, label: formatShortMonth(start), income: 0, expense: 0, current: i === 0 });
  }
  const byKey = Object.fromEntries(months.map((m) => [m.key, m]));
  rows.forEach((t) => {
    const m = byKey[monthKey(t.date)];
    if (m) m[t.type === 'income' ? 'income' : 'expense'] += t.amount;
  });
  return months;
}

export default function Overview() {
  const { currency } = useAuth();
  const { now, month, summary, history, recent, budgets, goals } = useOverviewData();
  const s = summary.data;
  const net = s ? s.income - s.expense : 0;

  const trend = useMemo(() => sixMonths(history.data?.rows || [], now), [history.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const cats = useMemo(() => spendingByCategory(s?.byCategory), [s]);
  const watch = useMemo(
    () =>
      (budgets.data || [])
        .map((b) => ({ ...b, pct: percent(b.current_spending, b.limit) }))
        .sort((a, b) => b.pct - a.pct),
    [budgets.data]
  );
  const flagged = watch.filter((b) => b.pct >= 80);

  let sentence = 'Nothing recorded this month yet. Add your first entry to start the page.';
  if (s && (s.income || s.expense)) {
    if (s.income && net >= 0) sentence = `You have kept ${formatMoney(net, currency)} of the ${formatMoney(s.income, currency)} that came in.`;
    else if (net < 0) sentence = `Spending is ${formatMoney(-net, currency)} ahead of income this month.`;
    else sentence = `${formatMoney(s.expense, currency)} spent and no income recorded yet this month.`;
  }

  return (
    <div className="page overview">
      <header className="page__head">
        <div>
          <h1 className="page__title">{formatMonth(now)}</h1>
          <p className="page__lede">The month so far, as of {formatDate(now)}.</p>
        </div>
        <Link to="/transactions?new=1" className="btn btn--primary">
          Add entry
        </Link>
      </header>

      <section className="ov-figures" aria-labelledby="ov-net">
        <div className="ov-net">
          <h2 id="ov-net" className="ov-label">
            Net this month
          </h2>
          {summary.loading && !s ? (
            <span className="skeleton ov-net__skeleton" />
          ) : (
            <Money amount={net} size="hero" />
          )}
          <p className="ov-net__sentence">{summary.error ? '' : sentence}</p>
          <ErrorNote error={summary.error} onRetry={() => summary.refetch()} />
        </div>
        <dl className="ov-split">
          <div className="ov-split__row">
            <dt className="ov-label">Income</dt>
            <dd>
              <Money amount={s?.income || 0} size="lg" type="income" />
            </dd>
          </div>
          <div className="ov-split__row">
            <dt className="ov-label">Spending</dt>
            <dd>
              <Money amount={s?.expense || 0} size="lg" type="expense" />
            </dd>
          </div>
          <div className="ov-split__row ov-split__row--meta">
            <dt className="ov-label">Entries</dt>
            <dd className="num">{s?.count ?? 0}</dd>
          </div>
        </dl>
      </section>

      <div className="ov-grid">
        <div className="ov-col">
          <section className="section" aria-labelledby="ov-trend">
            <div className="section__head">
              <h2 id="ov-trend" className="section__title">
                Six months
              </h2>
              <span className="muted ov-range">
                {formatShortMonth(monthRange(now, -5).start)} to {formatShortMonth(month.start)}
              </span>
            </div>
            {history.error ? (
              <ErrorNote error={history.error} onRetry={() => history.refetch()} />
            ) : history.loading && !history.data ? (
              <span className="skeleton ov-chart-skeleton" />
            ) : (
              <TrendChart months={trend} currency={currency} />
            )}
          </section>

          <section className="section" aria-labelledby="ov-recent">
            <div className="section__head">
              <h2 id="ov-recent" className="section__title">
                Recent entries
              </h2>
              <Link to="/transactions" className="section__link">
                All transactions
              </Link>
            </div>
            <ErrorNote error={recent.error} onRetry={() => recent.refetch()} />
            {recent.data && recent.data.rows.length === 0 && (
              <div className="empty">
                <p className="empty__title">No entries yet</p>
                <p>Record a salary, a bill or a coffee. Each one lands here and in the charts above.</p>
                <Link to="/transactions?new=1" className="btn">
                  Add first entry
                </Link>
              </div>
            )}
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

        <div className="ov-col ov-col--side">
          <section className="section" aria-labelledby="ov-cats">
            <div className="section__head">
              <h2 id="ov-cats" className="section__title">
                Where it went
              </h2>
            </div>
            {s && cats.length === 0 && (
              <p className="muted ov-note">No spending recorded this month. Categories appear as you add expenses.</p>
            )}
            {cats.length > 0 && <CategoryBars rows={cats.slice(0, 6)} currency={currency} />}
            {cats.length > 6 && (
              <p className="muted ov-note">
                {cats.length - 6} smaller {cats.length - 6 === 1 ? 'category' : 'categories'} not shown.
              </p>
            )}
          </section>

          <section className="section" aria-labelledby="ov-budgets">
            <div className="section__head">
              <h2 id="ov-budgets" className="section__title">
                Budget health
              </h2>
              <Link to="/budgets" className="section__link">
                Budgets
              </Link>
            </div>
            <ErrorNote error={budgets.error} onRetry={() => budgets.refetch()} />
            {budgets.data && budgets.data.length === 0 && (
              <p className="muted ov-note">
                No budgets yet. <Link to="/budgets">Set a monthly limit</Link> for a category you want to watch.
              </p>
            )}
            {budgets.data && budgets.data.length > 0 && flagged.length === 0 && (
              <p className="ov-note">
                All {budgets.data.length} {budgets.data.length === 1 ? 'budget is' : 'budgets are'} under 80% of their
                limit.
              </p>
            )}
            {flagged.length > 0 && (
              <ul className="health">
                {flagged.map((b) => {
                  const over = b.current_spending - b.limit;
                  return (
                    <li key={b.id} className="health__row">
                      <div className="health__top">
                        <span className="health__cat">{b.category}</span>
                        <span className={`health__state ${over > 0 ? 'is-out' : 'is-warn'}`}>
                          {over > 0 ? `Over by ${formatMoney(over, currency)}` : `${Math.round(b.pct)}% used`}
                        </span>
                      </div>
                      <Meter value={b.current_spending} max={b.limit} label={`${b.category} budget used`} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="section" aria-labelledby="ov-goals">
            <div className="section__head">
              <h2 id="ov-goals" className="section__title">
                Savings
              </h2>
              <Link to="/savings" className="section__link">
                Goals
              </Link>
            </div>
            <ErrorNote error={goals.error} onRetry={() => goals.refetch()} />
            {goals.data && goals.data.length === 0 && (
              <p className="muted ov-note">
                No goals yet. <Link to="/savings">Start one</Link> for a deposit, a trip or three months of cushion.
              </p>
            )}
            {goals.data && goals.data.length > 0 && (
              <ul className="health">
                {goals.data.slice(0, 4).map((g) => (
                  <li key={g.id} className="health__row">
                    <div className="health__top">
                      <span className="health__cat">{g.title}</span>
                      <span className="health__state num muted">
                        {Math.min(100, Math.round(percent(g.current_amount, g.target_amount)))}%
                      </span>
                    </div>
                    <Meter value={g.current_amount} max={g.target_amount} label={`${g.title} progress`} tone="goal" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
