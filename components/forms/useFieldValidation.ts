"use client";

import { FocusEvent, useState } from "react";
import { flushSync } from "react-dom";

export type FieldValidator = (value: string) => string | null;

export interface FieldA11yProps {
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
  onBlur: (event: FocusEvent<HTMLInputElement>) => void;
}

export interface FieldValidation<TField extends string> {
  /** Message per field, present only once that field has failed validation. */
  errors: Partial<Record<TField, string>>;
  /** Stable id for a field's error node, referenced by `aria-describedby`. */
  errorId: (field: TField) => string;
  /** Spread onto the input: blur validation plus the invalid/description wiring. */
  fieldProps: (field: TField, helpId?: string) => FieldA11yProps;
  /** Re-checks every field on submit, focuses the first invalid one, returns validity. */
  validateAll: (form: HTMLFormElement) => boolean;
  clear: () => void;
}

/**
 * Per-field validation for the site's forms: validated on blur (never on every
 * keystroke), reported next to the field in text, wired to `aria-invalid` and
 * `aria-describedby`, and focus moved to the first invalid field when a submit
 * is refused. Typed input is never cleared by a failure.
 */
export function useFieldValidation<TField extends string>(
  idPrefix: string,
  validators: Readonly<Record<TField, FieldValidator>>,
): FieldValidation<TField> {
  const [errors, setErrors] = useState<Partial<Record<TField, string>>>({});

  const isField = (name: string): name is TField => Object.prototype.hasOwnProperty.call(validators, name);
  const errorId = (field: TField): string => `${idPrefix}-${field}-error`;

  function setFieldError(field: TField, message: string | null): void {
    setErrors((current) => {
      if ((current[field] ?? null) === message) return current;
      const next = { ...current };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function fieldProps(field: TField, helpId?: string): FieldA11yProps {
    const invalid = Boolean(errors[field]);
    const described = [invalid ? errorId(field) : undefined, helpId].filter((id): id is string => Boolean(id));
    return {
      "aria-invalid": invalid ? true : undefined,
      "aria-describedby": described.length > 0 ? described.join(" ") : undefined,
      onBlur: (event: FocusEvent<HTMLInputElement>) => {
        const name = event.target.name;
        if (!isField(name)) return;
        setFieldError(name, validators[name](event.target.value));
      },
    };
  }

  function validateAll(form: HTMLFormElement): boolean {
    const next: Partial<Record<TField, string>> = {};
    let firstInvalid: HTMLInputElement | null = null;
    for (const name of Object.keys(validators)) {
      if (!isField(name)) continue;
      const control = form.elements.namedItem(name);
      const input = control instanceof HTMLInputElement ? control : null;
      const message = validators[name](input?.value ?? "");
      if (!message) continue;
      next[name] = message;
      if (!firstInvalid) firstInvalid = input;
    }
    // Committed before focus moves, not after. A submit is a discrete event, so
    // React would otherwise flush this state at the END of the handler — the
    // error node would still be absent and `aria-invalid`/`aria-describedby`
    // unset at the moment `focus()` fires, and a screen reader computes a
    // field's accessible description at focus time. The shopper would land on
    // the right field and be told nothing about why.
    flushSync(() => setErrors(next));
    const invalid = Object.keys(next).length > 0;
    if (invalid) firstInvalid?.focus();
    return !invalid;
  }

  return { errors, errorId, fieldProps, validateAll, clear: () => setErrors({}) };
}
