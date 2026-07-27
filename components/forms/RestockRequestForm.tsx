"use client";

import { FormEvent, useRef, useState } from "react";
import { submitNetlifyForm } from "@/components/forms/netlify-forms";
import { useFieldValidation } from "@/components/forms/useFieldValidation";
import { validateEmailField, validateRequiredField } from "@/components/forms/validation";

interface RestockRequestFormProps {
  initialProduct?: string;
  initialSize?: string;
}

const SUCCESS_TITLE = "Request saved";
const SUCCESS_BODY =
  "We will use this email only for availability updates about the requested product. A request does not reserve an item or guarantee a restock.";
const SUBMIT_ERROR =
  "We could not save the request. Try again, or email info@afterhoursagenda.com with the product and size.";

export function RestockRequestForm({ initialProduct = "", initialSize = "" }: RestockRequestFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  // The submit button stays focusable (`aria-disabled`, not `disabled`), so
  // double-submission is blocked here rather than by removing the control.
  const inFlight = useRef(false);
  const validation = useFieldValidation("restock", {
    product: (value) => validateRequiredField(value, "Enter the product name exactly as it appears on the product page."),
    size: (value) => validateRequiredField(value, "Enter the size, color, or variant shown on the product page."),
    email: validateEmailField,
  });

  const liveMessage =
    status === "sending" ? "Saving your restock request." : status === "success" ? `${SUCCESS_TITLE}. ${SUCCESS_BODY}` : status === "error" ? SUBMIT_ERROR : "";

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
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
      // Resolves only on a verified 2xx from the Netlify form handler; a failure
      // here means nothing was stored, so nothing may claim to have been stored.
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
    <>
      <p role="status" aria-live="polite" className="sr-only">{liveMessage}</p>
      {status === "success" ? (
        <div className="border-y border-border/40 py-8">
          <p className="font-display text-2xl font-bold uppercase">{SUCCESS_TITLE}</p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">{SUCCESS_BODY}</p>
        </div>
      ) : (
        <form name="restock-request" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} noValidate className="grid gap-5 border-y border-border/40 py-8 sm:grid-cols-2">
          <input type="hidden" name="form-name" value="restock-request" />
          <p className="hidden"><label>Do not fill this out: <input name="bot-field" tabIndex={-1} autoComplete="off" /></label></p>
          <div className="sm:col-span-2">
            <label htmlFor="restock-product" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em]">Product name (required)</label>
            <input id="restock-product" name="product" required defaultValue={initialProduct} autoComplete="off" className="min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream focus:border-accent focus:outline-none" {...validation.fieldProps("product")} />
            {validation.errors.product && <p id={validation.errorId("product")} className="mt-2 text-sm text-danger">{validation.errors.product}</p>}
          </div>
          <div>
            <label htmlFor="restock-size" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em]">Size or variant (required)</label>
            <input id="restock-size" name="size" required defaultValue={initialSize} autoComplete="off" className="min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream focus:border-accent focus:outline-none" {...validation.fieldProps("size", "restock-size-help")} />
            {validation.errors.size && <p id={validation.errorId("size")} className="mt-2 text-sm text-danger">{validation.errors.size}</p>}
            <p id="restock-size-help" className="mt-2 text-xs leading-relaxed text-muted">Use the exact size, color, or variant shown on the product page.</p>
          </div>
          <div>
            <label htmlFor="restock-email" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em]">Email address (required)</label>
            <input id="restock-email" name="email" type="email" required autoComplete="email" placeholder="name@example.com" className="min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none" {...validation.fieldProps("email")} />
            {validation.errors.email && <p id={validation.errorId("email")} className="mt-2 text-sm text-danger">{validation.errors.email}</p>}
          </div>
          <div className="sm:col-span-2">
            <button type="submit" aria-disabled={status === "sending"} className="primary-action min-h-12 px-5 py-3 text-sm aria-disabled:cursor-wait aria-disabled:opacity-60">{status === "sending" ? "Saving request..." : "Request a restock alert"}</button>
            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">This request is not a purchase, reservation, or promise that the product will return. It does not add you to the general email list.</p>
            {status === "error" && <p className="mt-3 border-l-2 border-danger pl-4 text-sm text-danger">{SUBMIT_ERROR}</p>}
          </div>
        </form>
      )}
    </>
  );
}
