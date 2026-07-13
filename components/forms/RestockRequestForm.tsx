"use client";

import { FormEvent, useState } from "react";

interface RestockRequestFormProps {
  initialProduct?: string;
  initialSize?: string;
}

export function RestockRequestForm({ initialProduct = "", initialSize = "" }: RestockRequestFormProps) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = event.currentTarget;
    const body = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) body.append(key, String(value));

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });
      if (!response.ok) throw new Error("Restock request was not accepted");
      form.reset();
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div role="status" className="border-y border-border/40 py-8">
        <p className="font-display text-2xl font-bold uppercase">Request saved</p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">We will use this email only for availability updates about the requested product. A request does not reserve an item or guarantee a restock.</p>
      </div>
    );
  }

  return (
    <form name="restock-request" method="POST" data-netlify="true" netlify-honeypot="bot-field" onSubmit={submit} className="grid gap-5 border-y border-border/40 py-8 sm:grid-cols-2">
      <input type="hidden" name="form-name" value="restock-request" />
      <p className="hidden"><label>Do not fill this out: <input name="bot-field" /></label></p>
      <div className="sm:col-span-2">
        <label htmlFor="restock-product" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em]">Product name</label>
        <input id="restock-product" name="product" required defaultValue={initialProduct} autoComplete="off" className="min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream focus:border-accent focus:outline-none" />
      </div>
      <div>
        <label htmlFor="restock-size" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em]">Size or variant</label>
        <input id="restock-size" name="size" required defaultValue={initialSize} autoComplete="off" aria-describedby="restock-size-help" className="min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream focus:border-accent focus:outline-none" />
        <p id="restock-size-help" className="mt-2 text-xs leading-relaxed text-muted">Use the exact size, color, or variant shown on the product page.</p>
      </div>
      <div>
        <label htmlFor="restock-email" className="mb-2 block font-mono text-xs font-bold uppercase tracking-[0.06em]">Email address</label>
        <input id="restock-email" name="email" type="email" required autoComplete="email" placeholder="name@example.com" className="min-h-12 w-full border border-border/60 bg-void px-3 py-3 text-base text-cream placeholder:text-muted focus:border-accent focus:outline-none" />
      </div>
      <div className="sm:col-span-2">
        <button type="submit" disabled={status === "sending"} className="primary-action min-h-12 px-5 py-3 text-sm disabled:cursor-wait disabled:opacity-60">{status === "sending" ? "Saving request..." : "Request a restock alert"}</button>
        <p className="mt-3 max-w-2xl text-xs leading-relaxed text-muted">This request is not a purchase, reservation, or promise that the product will return. It does not add you to the general email list.</p>
        {status === "error" && <p role="alert" className="mt-3 border-l-2 border-error pl-4 text-sm text-error">We could not save the request. Try again, or email info@afterhoursagenda.com with the product and size.</p>}
      </div>
    </form>
  );
}
