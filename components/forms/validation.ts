/**
 * Field validators shared by the site's forms.
 *
 * Every message says how to fix the field, never just that it is wrong, and is
 * rendered as text beside its input — colour is never the only error signal.
 */

/** Deliberately permissive: catches typos and empty submits, rejects nothing deliverable. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

export function validateEmailField(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Enter your email address.";
  if (!EMAIL_PATTERN.test(trimmed)) return "Enter an email address in the format name@example.com.";
  return null;
}

export function validateRequiredField(value: string, message: string): string | null {
  return value.trim() ? null : message;
}
