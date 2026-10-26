import { useCallback, useRef, useState } from 'react';

/**
 * Blur-first validation. A field shows its error once the user leaves it (or submits);
 * after that the message updates as they type and disappears as soon as the value is fixed.
 * validate(values) returns { field: message } for every problem.
 */
export function useForm(initial, validate) {
  const [values, setValuesState] = useState(initial);
  const valuesRef = useRef(values);
  const [errors, setErrors] = useState({});
  const touched = useRef(new Set());
  const validateRef = useRef(validate);
  validateRef.current = validate;

  const recheck = useCallback((next, keys) => {
    const all = validateRef.current(next);
    setErrors((prev) => {
      const out = { ...prev };
      keys.forEach((k) => {
        if (touched.current.has(k) && all[k]) out[k] = all[k];
        else delete out[k];
      });
      return out;
    });
  }, []);

  const setValues = useCallback((next) => {
    valuesRef.current = typeof next === 'function' ? next(valuesRef.current) : next;
    setValuesState(valuesRef.current);
  }, []);

  const setValue = useCallback(
    (key, value) => {
      const next = { ...valuesRef.current, [key]: value };
      setValues(next);
      if (touched.current.has(key)) recheck(next, [key]);
    },
    [recheck, setValues]
  );

  const blur = useCallback(
    (key) => {
      touched.current.add(key);
      recheck(valuesRef.current, [key]);
    },
    [recheck]
  );

  /** Validates everything; returns the errors (empty object when the form is valid). */
  const validateAll = useCallback(() => {
    const all = validateRef.current(valuesRef.current);
    Object.keys(valuesRef.current).forEach((k) => touched.current.add(k));
    Object.keys(all).forEach((k) => touched.current.add(k));
    setErrors(all);
    return all;
  }, []);

  /** Server errors mapped to fields (they show straight away). */
  const setServerErrors = useCallback((errs) => {
    Object.keys(errs).forEach((k) => touched.current.add(k));
    setErrors((prev) => ({ ...prev, ...errs }));
  }, []);

  const reset = useCallback(
    (next) => {
      touched.current = new Set();
      setErrors({});
      setValues(next);
    },
    [setValues]
  );

  /** Props for a text-like input bound to `key`. */
  const bind = (key, { describedBy = [] } = {}) => ({
    name: key,
    value: values[key] ?? '',
    onChange: (e) => setValue(key, e.target.value),
    onBlur: () => blur(key),
    'aria-invalid': errors[key] ? 'true' : undefined,
    'aria-describedby': describedBy.filter(Boolean).join(' ') || undefined,
  });

  return { values, errors, setValue, setValues, blur, validateAll, setServerErrors, reset, bind };
}

/** Focuses the first invalid control inside a form, in DOM order. */
export function focusFirstError(form, errors) {
  if (!form) return;
  const names = Object.keys(errors).filter((k) => k !== '_form');
  const els = names.map((n) => form.querySelector(`[name="${n}"]`)).filter(Boolean);
  els.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  els[0]?.focus();
}
