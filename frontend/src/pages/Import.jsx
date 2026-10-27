import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import Money from '../components/Money.jsx';
import { categoryOptions, useCategories } from '../lib/categories.js';
import { fetchAllTransactions, importTransactions } from '../lib/data.js';
import { formatDate } from '../lib/format.js';
import { ROLES, ROLE_LABELS, analyseRows, draftTotals, editDraft, isCompleteMapping, markDuplicates, toImportRow } from '../lib/statement/index.js';
import { ACCEPT, StatementError, checkFile, readStatement } from '../lib/statement/readers.js';
import { invalidate } from '../lib/useResource.js';
import { LIMITS, paymentLabel } from '../lib/validate.js';
import './Import.css';

const PAGE = 100;
const STEPS = [
  ['pick', 'Choose a file'],
  ['check', 'Check the rows'],
  ['import', 'Import'],
];
const stepOf = (stage) => (['pick', 'reading', 'password', 'map'].includes(stage) ? 'pick' : stage === 'preview' ? 'check' : 'import');
const EMPTY_TOTALS = { received: 0, inserted: 0, duplicates: 0, invalid: [] };
function addTotals(a, b) {
  const x = a || EMPTY_TOTALS;
  const y = b || EMPTY_TOTALS;
  return {
    received: x.received + y.received,
    inserted: x.inserted + y.inserted,
    duplicates: x.duplicates + y.duplicates,
    invalid: [...x.invalid, ...y.invalid],
  };
}
const count = (n, one, many) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

function Steps({ stage }) {
  const current = stepOf(stage);
  const idx = STEPS.findIndex(([k]) => k === current);
  return (
    <ol className="steps" aria-label="Import steps">
      {STEPS.map(([k, label], i) => (
        <li key={k} className={`steps__item${i < idx ? ' is-done' : ''}${i === idx ? ' is-current' : ''}`} aria-current={i === idx ? 'step' : undefined}>
          <span className="steps__num num" aria-hidden="true">
            {i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function DropZone({ onFile, error }) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const hintId = useId();

  return (
    <section className="drop-wrap" aria-labelledby="drop-title">
      <div
        className={`drop${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <Icon name="file" size={28} className="drop__icon" />
        <h2 id="drop-title" className="drop__title">
          Drop a statement here
        </h2>
        <p id={hintId} className="drop__hint">
          CSV, Excel (.xlsx) or PDF, up to 10 MB. The file is read on this device and never uploaded.
        </p>
        <label htmlFor="stmt-file" className="visually-hidden">
          Statement file
        </label>
        <input
          ref={inputRef}
          id="stmt-file"
          type="file"
          accept={ACCEPT}
          className="visually-hidden"
          tabIndex={-1}
          aria-describedby={hintId}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onFile(f);
          }}
        />
        <button type="button" className="btn btn--primary" onClick={() => inputRef.current?.click()} aria-describedby={hintId}>
          Choose a file
        </button>
      </div>
      {error && (
        <p className="errnote" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Help() {
  return (
    <aside className="import-help" aria-label="Supported statements">
      <h2 className="section__title">What it reads</h2>
      <dl className="import-help__list">
        <div>
          <dt>Bank statements</dt>
          <dd>CSV, Excel and PDF downloads from HDFC, SBI, ICICI, Axis, Kotak and most other banks with a date, narration and debit, credit or amount columns.</dd>
        </div>
        <div>
          <dt>UPI apps</dt>
          <dd>PhonePe, Google Pay and Paytm PDF statements with lines such as "Paid to" and "Received from".</dd>
        </div>
        <div>
          <dt>Image PDFs</dt>
          <dd>PDFs without selectable text, such as Union Bank downloads and scans, are read with text recognition. Check the amounts before importing.</dd>
        </div>
        <div>
          <dt>Privacy</dt>
          <dd>Parsing happens in this browser. Only the rows you choose are sent to your ledger.</dd>
        </div>
      </dl>
    </aside>
  );
}

function PasswordStep({ fileName, error, onSubmit, onCancel }) {
  const [pw, setPw] = useState('');
  const [local, setLocal] = useState('');
  return (
    <form
      className="import-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pw) {
          setLocal('Enter the PDF password.');
          return;
        }
        onSubmit(pw);
      }}
      noValidate
    >
      <h2 className="section__title">This PDF is locked</h2>
      <p className="muted">
        {fileName} needs a password to open. Banks often use part of your name with your date of birth. The password is
        used on this device only.
      </p>
      <div className="field">
        <label className="field__label" htmlFor="pdf-pw">
          PDF password
        </label>
        <input
          id="pdf-pw"
          className="input"
          type="password"
          autoComplete="off"
          maxLength={128}
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            if (e.target.value) setLocal('');
          }}
          aria-invalid={local || error ? 'true' : undefined}
          aria-describedby="pdf-pw-err"
          autoFocus
        />
        <p id="pdf-pw-err" className="field__error" role="alert">
          {local || error}
        </p>
      </div>
      <div className="import-card__actions">
        <button type="submit" className="btn btn--primary">
          Open PDF
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Choose another file
        </button>
      </div>
    </form>
  );
}

const cellText = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '')).slice(0, 40);

function MappingStep({ analysis, onApply, onCancel }) {
  const width = Math.max(0, ...analysis.rows.slice(0, 80).map((r) => r.length));
  const [headerRow, setHeaderRow] = useState(analysis.headerRow);
  const [mapping, setMapping] = useState(() => ({ ...analysis.mapping }));
  const [dayFirst, setDayFirst] = useState(analysis.dayFirst !== false);
  const [error, setError] = useState('');
  const sampleStart = headerRow + 1;
  const samples = analysis.rows.slice(sampleStart, sampleStart + 3);
  const colName = (i) => {
    const h = headerRow >= 0 ? cellText(analysis.rows[headerRow]?.[i]) : '';
    const ex = samples.map((r) => cellText(r[i])).find(Boolean);
    return `Column ${i + 1}${h ? `: ${h}` : ''}${ex ? ` (for example ${ex})` : ''}`;
  };

  const apply = (e) => {
    e.preventDefault();
    if (!isCompleteMapping(mapping)) {
      setError('Choose the date, the description, and either one amount column or both money out and money in.');
      return;
    }
    setError('');
    onApply({ mapping, headerRow, dayFirst });
  };

  const set = (role, v) => {
    setMapping((m) => {
      const next = { ...m };
      if (v === '') delete next[role];
      else next[role] = Number(v);
      return next;
    });
    setError('');
  };

  return (
    <form className="import-card mapping" onSubmit={apply} noValidate>
      <h2 className="section__title">Match the columns</h2>
      <p className="muted">
        The columns in this file could not all be recognised. Say which column holds what. Use one amount column, or a
        money out and a money in column.
      </p>
      <div className="mapping__grid">
        <div className="field">
          <label className="field__label" htmlFor="map-header">
            Header row
          </label>
          <select id="map-header" className="input" value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))}>
            <option value={-1}>No header row</option>
            {analysis.rows.slice(0, 40).map((r, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <option key={i} value={i}>
                Row {i + 1}: {r.map(cellText).filter(Boolean).join(', ').slice(0, 60)}
              </option>
            ))}
          </select>
        </div>
        {ROLES.filter((r) => r !== 'reference').map((role) => (
          <div className="field" key={role}>
            <label className="field__label" htmlFor={`map-${role}`}>
              {ROLE_LABELS[role]}
            </label>
            <select id={`map-${role}`} className="input" value={mapping[role] ?? ''} onChange={(e) => set(role, e.target.value)}>
              <option value="">Not in this file</option>
              {Array.from({ length: width }, (_, i) => (
                <option key={i} value={i}>
                  {colName(i)}
                </option>
              ))}
            </select>
          </div>
        ))}
        <fieldset className="mapping__dates">
          <legend className="field__label">Dates are written</legend>
          <div className="seg">
            {[
              [true, 'Day first (31/12)'],
              [false, 'Month first (12/31)'],
            ].map(([v, label]) => (
              <label key={label} className="seg__opt">
                <input type="radio" name="dayfirst" checked={dayFirst === v} onChange={() => setDayFirst(v)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="field__error" role="alert">
        {error}
      </p>
      <div className="import-card__actions">
        <button type="submit" className="btn btn--primary">
          Use these columns
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Choose another file
        </button>
      </div>
    </form>
  );
}

function PreviewRow({ d, onChange }) {
  const problems = Object.values(d.errors || {});
  const invalid = problems.length > 0;
  const label = d.description || `row ${d.line}`;
  return (
    <tr className={`${invalid ? 'is-invalid' : ''}${!d.include ? ' is-off' : ''}`}>
      <td className="pv__inc">
        <input
          type="checkbox"
          className="check"
          checked={d.include}
          disabled={invalid}
          onChange={(e) => onChange(d.key, { include: e.target.checked }, true)}
          aria-label={`Include ${label}`}
        />
      </td>
      <td className="pv__date num">{d.date ? formatDate(d.date) : <span className="is-out">{d.rawDate || 'No date'}</span>}</td>
      <td className="pv__desc">
        <span className="pv__text">{d.description}</span>
        <span className="pv__meta muted">
          {paymentLabel(d.payment_method)}
          {d.notes ? ` · ${d.notes}` : ''}
        </span>
        {invalid && <span className="pv__problem">{problems.join(' ')}</span>}
        {!invalid && d.dup && (
          <span className="pv__dup">{d.dup === 'ledger' ? 'Possible duplicate: a matching entry is already in the ledger.' : 'Possible duplicate: repeated in this file.'}</span>
        )}
        {!invalid && d.guessedType && <span className="pv__dup">Money in or out was not marked; check the type.</span>}
      </td>
      <td className="pv__cat">
        <input
          className="input input--sm"
          list="pv-cats"
          maxLength={LIMITS.category}
          value={d.category}
          onChange={(e) => onChange(d.key, { category: e.target.value })}
          aria-label={`Category for ${label}`}
          aria-invalid={d.errors?.category ? 'true' : undefined}
        />
      </td>
      <td className="pv__type">
        <select className="input input--sm" value={d.type} onChange={(e) => onChange(d.key, { type: e.target.value })} aria-label={`Type for ${label}`}>
          <option value="expense">Spending</option>
          <option value="income">Income</option>
        </select>
      </td>
      <td className="pv__amt">
        <Money amount={d.amount} type={d.type} signed />
      </td>
    </tr>
  );
}

function Preview({ analysis, drafts, setDrafts, onImport, onRemap, onReset }) {
  const [filter, setFilter] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const used = useCategories();
  const options = useMemo(() => [...new Set([...categoryOptions(used, 'expense'), ...categoryOptions(used, 'income')])], [used]);
  const totals = useMemo(() => draftTotals(drafts), [drafts]);
  const invalid = drafts.filter((d) => Object.keys(d.errors || {}).length).length;
  const dups = drafts.filter((d) => d.dup && !Object.keys(d.errors || {}).length).length;
  const list = drafts.filter((d) =>
    filter === 'problems' ? Object.keys(d.errors || {}).length : filter === 'dups' ? d.dup : true
  );

  const change = (key, patch, plain) =>
    setDrafts((all) => all.map((d) => (d.key === key ? (plain ? { ...d, ...patch } : editDraft(d, patch)) : d)));
  const selectAll = (on) =>
    setDrafts((all) => all.map((d) => (Object.keys(d.errors || {}).length ? d : { ...d, include: on })));

  return (
    <section className="preview" aria-labelledby="pv-title">
      <div className="section__head">
        <h2 id="pv-title" className="section__title">
          {analysis.fileName}
        </h2>
        {analysis.layout === 'table' && (
          <button type="button" className="link-btn" onClick={onRemap}>
            Change columns
          </button>
        )}
      </div>

      <dl className="pv-sum">
        <div>
          <dt>Rows to import</dt>
          <dd className="num">{totals.count.toLocaleString('en-IN')}</dd>
        </div>
        <div>
          <dt>Money in</dt>
          <dd>
            <Money amount={totals.income} type="income" />
          </dd>
        </div>
        <div>
          <dt>Money out</dt>
          <dd>
            <Money amount={totals.expense} type="expense" />
          </dd>
        </div>
        <div>
          <dt>Dates</dt>
          <dd className="num pv-sum__dates">{totals.from ? `${formatDate(totals.from)} to ${formatDate(totals.to)}` : 'None selected'}</dd>
        </div>
      </dl>

      <ul className="pv-notes">
        <li>
          {count(drafts.length, 'entry', 'entries')} found
          {analysis.skipped > 0 && `, ${count(analysis.skipped, 'line', 'lines')} skipped (balances, totals and blank lines)`}.
          {analysis.truncated && ' Only the first 5,000 entries are shown; import the rest from a shorter statement.'}
        </li>
        {invalid > 0 && <li className="is-out">{count(invalid, 'row needs', 'rows need')} attention and will not be imported as they are.</li>}
        {dups > 0 && (
          <li className="is-warn">
            {count(dups, 'row looks', 'rows look')} like a possible duplicate. Rows already imported before are skipped by the
            server either way.
          </li>
        )}
      </ul>

      <div className="pv-bar">
        <fieldset className="pv-bar__filter">
          <legend className="visually-hidden">Show</legend>
          <div className="seg">
            {[
              ['all', 'All'],
              ['problems', `Needs attention (${invalid})`],
              ['dups', `Duplicates (${dups})`],
            ].map(([v, label]) => (
              <label key={v} className="seg__opt">
                <input type="radio" name="pv-filter" checked={filter === v} onChange={() => setFilter(v)} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="pv-bar__sel">
          <button type="button" className="link-btn" onClick={() => selectAll(true)}>
            Select all valid
          </button>
          <button type="button" className="link-btn" onClick={() => selectAll(false)}>
            Clear selection
          </button>
        </div>
      </div>

      <datalist id="pv-cats">
        {options.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {list.length === 0 ? (
        <p className="muted">Nothing to show with this filter.</p>
      ) : (
        <div className="pv-wrap">
          <table className="pv">
            <caption className="visually-hidden">Rows read from {analysis.fileName}</caption>
            <thead>
              <tr>
                <th scope="col" className="pv__inc">
                  <span className="visually-hidden">Include</span>
                </th>
                <th scope="col" className="pv__date">
                  Date
                </th>
                <th scope="col">Description</th>
                <th scope="col" className="pv__cat">
                  Category
                </th>
                <th scope="col" className="pv__type">
                  Type
                </th>
                <th scope="col" className="pv__amt">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {list.slice(0, shown).map((d) => (
                <PreviewRow key={d.key} d={d} onChange={change} />
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.length > shown && (
        <button type="button" className="btn pv-more" onClick={() => setShown((s) => s + PAGE)}>
          Show {Math.min(PAGE, list.length - shown)} more of {list.length - shown}
        </button>
      )}

      <div className="pv-foot">
        <button type="button" className="btn btn--primary" onClick={onImport} disabled={totals.count === 0}>
          <Icon name="import" size={18} />
          Import {count(totals.count, 'row', 'rows')}
        </button>
        <button type="button" className="btn" onClick={onReset}>
          Choose another file
        </button>
      </div>
    </section>
  );
}

export default function Import() {
  const [stage, setStage] = useState('pick');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [ocr, setOcr] = useState(null);
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const sentRows = useRef([]);
  const headingRef = useRef(null);

  useEffect(() => {
    if (stage !== 'pick') headingRef.current?.focus();
  }, [stage]);

  function reset() {
    setStage('pick');
    setFile(null);
    setError('');
    setAnalysis(null);
    setDrafts([]);
    setResult(null);
    setFailure(null);
  }

  async function withDuplicates(list) {
    const dated = list.filter((d) => d.date);
    if (!dated.length) return list;
    const from = dated.reduce((m, d) => (d.date < m ? d.date : m), dated[0].date);
    const to = dated.reduce((m, d) => (d.date > m ? d.date : m), dated[0].date);
    try {
      const { rows } = await fetchAllTransactions({ startDate: from, endDate: to, maxPages: 4 });
      return markDuplicates(list, rows);
    } catch {
      return markDuplicates(list, []);
    }
  }

  async function show(result) {
    setAnalysis(result);
    if (!result.drafts.length || result.confidence === 'low') {
      if (result.layout === 'table' && result.rows.length) {
        setStage('map');
        return;
      }
      setError('No transactions were found in this file. Check that it is a bank or UPI statement, or download it as CSV.');
      setStage('pick');
      return;
    }
    setDrafts(await withDuplicates(result.drafts));
    setStage('preview');
  }

  async function read(f, password) {
    const problem = checkFile(f);
    if (problem) {
      setError(problem);
      setStage('pick');
      return;
    }
    setFile(f);
    setError('');
    setStage('reading');
    setOcr(null);
    try {
      await show(await readStatement(f, { password, onProgress: setOcr }));
    } catch (err) {
      if (!(err instanceof StatementError)) console.error('Statement read failed', err);
      if (err instanceof StatementError && (err.code === 'need-password' || err.code === 'wrong-password')) {
        setError(err.code === 'wrong-password' ? err.message : '');
        setStage('password');
        return;
      }
      setError(err instanceof StatementError ? err.message : 'This file could not be read. Try a CSV download of the same statement.');
      setStage('pick');
    }
  }

  async function remap({ mapping, headerRow, dayFirst }) {
    const next = { ...analyseRows(analysis.rows, { mapping, headerRow, dayFirst }), kind: analysis.kind, fileName: analysis.fileName };
    if (!next.drafts.length) {
      setAnalysis(next);
      setError('No rows with a date and an amount were found with these columns.');
      return;
    }
    setError('');
    setAnalysis({ ...next, confidence: 'high' });
    setDrafts(await withDuplicates(next.drafts));
    setStage('preview');
  }

  async function runImport(startAt = 0, base = null) {
    const rows = startAt === 0 ? drafts.filter((d) => d.include && !Object.keys(d.errors || {}).length) : sentRows.current;
    sentRows.current = rows;
    setFailure(null);
    setStage('importing');
    setProgress({ sent: startAt, total: rows.length });
    try {
      const totals = await importTransactions({
        fileName: analysis.fileName,
        rows: rows.map(toImportRow),
        startAt,
        onProgress: setProgress,
      });
      setResult(addTotals(base, totals));
      setStage('done');
    } catch (err) {
      setFailure({ message: err.message, nextIndex: err.nextIndex ?? startAt, partial: addTotals(base, err.partial) });
      setStage('importing');
    } finally {
      invalidate('transactions', 'budgets', 'summary', 'categories');
    }
  }

  const sent = sentRows.current;
  const pct = progress.total ? Math.round((progress.sent / progress.total) * 100) : 0;

  return (
    <div className="page importpage">
      <header className="page__head">
        <div>
          <h1 className="page__title">Import</h1>
          <p className="page__lede">
            Add a bank or UPI statement to the ledger. The file is read in this browser; you check every row before anything is
            saved.
          </p>
        </div>
      </header>

      <Steps stage={stage} />

      {stage === 'pick' && (
        <div className="import-pick">
          <DropZone onFile={(f) => read(f)} error={error} />
          <Help />
        </div>
      )}

      {stage === 'reading' && (
        <div className="import-card" role="status">
          <h2 className="section__title" ref={headingRef} tabIndex={-1}>
            Reading {file?.name}
          </h2>
          <span className="skeleton import-skeleton" aria-hidden="true" />
          <p className="muted">
            {!ocr
              ? 'Large PDF statements can take a few seconds.'
              : ocr.phase === 'loading'
                ? 'This PDF has no text layer, so it is being read as an image. Loading text recognition (about 5 MB, once).'
                : `Recognising text on page ${ocr.page} of ${ocr.pages}. This stays on your device.`}
          </p>
        </div>
      )}

      {stage === 'password' && (
        <PasswordStep fileName={file?.name} error={error} onSubmit={(pw) => read(file, pw)} onCancel={reset} />
      )}

      {stage === 'map' && analysis && (
        <>
          {error && (
            <p className="errnote" role="alert">
              {error}
            </p>
          )}
          <MappingStep analysis={analysis} onApply={remap} onCancel={reset} />
        </>
      )}

      {stage === 'preview' && analysis && (
        <Preview
          analysis={analysis}
          drafts={drafts}
          setDrafts={setDrafts}
          onImport={() => runImport(0)}
          onRemap={() => setStage('map')}
          onReset={reset}
        />
      )}

      {stage === 'importing' && (
        <section className="import-card" aria-labelledby="imp-title">
          <h2 id="imp-title" className="section__title" ref={headingRef} tabIndex={-1}>
            {failure ? 'Import stopped' : 'Importing'}
          </h2>
          <progress className="import-progress" max={progress.total || 1} value={progress.sent} aria-labelledby="imp-title imp-count" />
          <p id="imp-count" className="num" role="status" aria-live="polite">
            {progress.sent.toLocaleString('en-IN')} of {count(progress.total, 'row', 'rows')} sent ({pct}%)
          </p>
          {failure && (
            <div className="errnote" role="alert">
              <p>
                {failure.message} {count(failure.partial.inserted, 'row was', 'rows were')} added before it stopped.
              </p>
              <button type="button" className="link-btn" onClick={() => runImport(failure.nextIndex, failure.partial)}>
                Send the remaining rows
              </button>
            </div>
          )}
        </section>
      )}

      {stage === 'done' && result && (
        <section className="import-card result" aria-labelledby="done-title">
          <h2 id="done-title" className="section__title" ref={headingRef} tabIndex={-1}>
            Import finished
          </h2>
          <dl className="pv-sum">
            <div>
              <dt>Added to the ledger</dt>
              <dd className="num is-in">{result.inserted.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt>Skipped as duplicates</dt>
              <dd className="num">{result.duplicates.toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt>Rejected</dt>
              <dd className={`num${result.invalid.length ? ' is-out' : ''}`}>{result.invalid.length.toLocaleString('en-IN')}</dd>
            </div>
          </dl>
          {result.invalid.length > 0 && (
            <ul className="result__invalid">
              {result.invalid.slice(0, 10).map((x) => (
                <li key={x.index}>
                  <strong>{sent[x.index]?.description || `Row ${x.index + 1}`}</strong>
                  {sent[x.index]?.date ? ` (${formatDate(sent[x.index].date)})` : ''}: {x.errors.join(', ')}
                </li>
              ))}
              {result.invalid.length > 10 && <li>and {count(result.invalid.length - 10, 'more row', 'more rows')}.</li>}
            </ul>
          )}
          <div className="import-card__actions">
            <Link to="/transactions?source=import" className="btn btn--primary">
              View imported entries
            </Link>
            <button type="button" className="btn" onClick={reset}>
              Import another statement
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
