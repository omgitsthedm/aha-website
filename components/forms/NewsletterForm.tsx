"use client";

import { FormEvent, useRef, useState } from "react";
import { submitNetlifyForm } from "@/components/forms/netlify-forms";
import { useFieldValidation } from "@/components/forms/useFieldValidation";
import { validateEmailField } from "@/components/forms/validation";

interface NewsletterFormProps {
  /** Unique per instance — several of these can render on one page (footer plus section). */
  instanceId: string;
  /** Outer wrapper: positioning and width only, so each slot keeps its own layout. */
  className?: string;
  /** The form element itself: the input/button row. */
  rowClassName?: string;
  labelText?: string;
  labelClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  buttonLabel?: string;
  placeholder?: string;
  helpText?: string;
  helpClassName?: string;
  messageClassName?: string;
  successClassName?: string;
  /** Typeface hook for the success block so each slot keeps its own voice. */
  successFontClassName?: string;
  successTitle?: string;
  successBody?: string;
}

const SUCCESS_TITLE = "You are on the list.";
const SUCCESS_BODY = "You will receive the next After Hours Agenda email update. Every message carries an unsubscribe link.";
const SUBMIT_ERROR = "We could not save your email. Try again, or email info@afterhoursagenda.com and we will add you.";

/**
 * The single newsletter signup implementation. Every newsletter slot on the site
 * renders this so there is one submission path, one honeypot, one validation
 * rule set, and one honest success state — see `netlify-forms.ts` for why the
 * endpoint is `/__forms.html` and never `/`.
 */
export function NewsletterForm({
  instanceId,
  className,
  rowClassName = "flex flex-col gap-3 sm:flex-row",
  labelText = "Email address (required)",
  labelClassName = "sr-only",
  inputClassName = "min-h-12 min-w-0 flex-1 border border-border/60 bg-void px-4 text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none",
  buttonClassName = "btn-primary min-h-12 px-6 aria-disabled:cursor-wait aria-disabled:opacity-60",
  buttonLabel = "Subscribe",
  placeholder = "you@email.com",
  helpText,
  helpClassName = "mt-3 text-xs leading-relaxed text-muted",
  messageClassName = "mt-3 text-sm",
  successClassName = "border border-success p-4",
  successFontClassName = "",
  successTitle = SUCCESS_TITLE,
  successBody = SUCCESS_BODY,
}: NewsletterFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  // The submit button stays focusable (`aria-disabled`, not `disabled`), so
  // double-submission is blocked here rather than by removing the control.
  const inFlight = useRef(false);
  const validation = useFieldValidation(instanceId, { email: validateEmailField });

  const fieldId = `${instanceId}-email`;
  const helpId = helpText ? `${instanceId}-help` : undefined;
  const fieldError = validation.errors.email;
  const liveMessage =
    status === "sending" ? "Sending your email address." : status === "success" ? `${successTitle} ${successBody}` : status === "error" ? SUBMIT_ERROR : "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (inFlight.current) return;
    // Captured before the first await: React nulls `currentTarget` synchronously
    // once dispatch returns, so touching it afterwards throws.
    const form = event.currentTarget;
    if (!validation.validateAll(form)) {
      setStatus("idle");
      return;
    }
    inFlight.current = true;
    setStatus("sending");
    try {
      await submitNetlifyForm(form);
      form.reset();
      validation.clear();
      setStatus("success");
    } catch {
      setStatus("error");
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div className={className}>
      <p role="status" aria-live="polite" className="sr-only">{liveMessage}</p>
      {status === "success" ? (
        <div className={successClassName}>
          <p className={`text-sm font-bold text-success ${successFontClassName}`}>{successTitle}</p>
          <p className={`mt-2 text-sm text-muted ${successFontClassName}`}>{successBody}</p>
        </div>
      ) : (
        <>
          <label htmlFor={fieldId} className={labelClassName}>{labelText}</label>
          {/* No `action`: a scripted submit posts to /__forms.html (see netlify-forms.ts),
              and the no-JS fallback posts to the current URL, which Netlify's handler
              intercepts and returns the reader to. The old action="/newsletter" bounced
              footer subscribers off whatever page they were reading. */}
          <form name="newsletter" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={handleSubmit} noValidate className={rowClassName}>
            <input type="hidden" name="form-name" value="newsletter" />
            <p className="hidden"><label>Do not fill this out: <input name="bot-field" tabIndex={-1} autoComplete="off" /></label></p>
            <input id={fieldId} name="email" type="email" required autoComplete="email" placeholder={placeholder} className={inputClassName} {...validation.fieldProps("email", helpId)} />
            <button type="submit" aria-disabled={status === "sending"} className={buttonClassName}>{status === "sending" ? "Joining..." : buttonLabel}</button>
          </form>
          {fieldError && <p id={validation.errorId("email")} className={`${messageClassName} text-danger`}>{fieldError}</p>}
          {helpText && <p id={helpId} className={helpClassName}>{helpText}</p>}
          {status === "error" && <p className={`${messageClassName} text-danger`}>{SUBMIT_ERROR}</p>}
        </>
      )}
    </div>
  );
}
