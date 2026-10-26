/** Visible "120 / 200" counter. Screen readers hear the remaining count only when it gets close to the limit. */
export function CharCount({ id, value = '', max }) {
  const used = String(value).length;
  const left = max - used;
  const near = left <= Math.max(10, Math.round(max * 0.1));
  return (
    <span id={id} className={`field__count num${left < 0 ? ' is-over' : near ? ' is-near' : ''}`}>
      <span aria-hidden="true">
        {used} / {max}
      </span>
      <span className="visually-hidden" aria-live="polite">
        {near ? `${Math.max(left, 0)} characters left` : ''}
      </span>
    </span>
  );
}

/** Label row with an optional counter on the right. */
export function LabelRow({ htmlFor, children, count }) {
  return (
    <div className="field__row">
      <label className="field__label" htmlFor={htmlFor}>
        {children}
      </label>
      {count}
    </div>
  );
}
