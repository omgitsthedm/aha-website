export function enhanceCustomerForms() {
  for (const form of document.querySelectorAll<HTMLFormElement>(
    "[data-customer-form]",
  )) {
    form.hidden = false;
    const topic = form.querySelector<HTMLSelectElement>('select[name="topic"]');
    const requested = new URLSearchParams(location.search).get("topic");
    if (
      topic &&
      requested &&
      [...topic.options].some((option) => option.value === requested)
    )
      topic.value = requested;
    const status = form.querySelector<HTMLElement>(".form-result")!;
    const submit = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (submit.disabled || !form.reportValidity()) return;
      const data = new FormData(form);
      if (data.get("website")) return;
      submit.disabled = true;
      form.setAttribute("aria-busy", "true");
      status.textContent = "Sending…";
      try {
        if (form.dataset.preview === "true") {
          status.textContent =
            "Test complete. The form is valid. Nothing was sent or saved to a mailing list.";
        } else {
          const body = new URLSearchParams();
          data.forEach((value, key) => body.set(key, String(value)));
          const response = await fetch("/__forms.html", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
          });
          if (!response.ok) throw new Error("Delivery unavailable");
          status.textContent =
            form.dataset.kind === "newsletter"
              ? "You’re on the list. Thank you for being here. Leave the list through the unsubscribe page at any time."
              : "Your request has been received. We will reply to the email address you provided.";
          document.dispatchEvent(
            new CustomEvent("aha:conversion", {
              detail:
                form.dataset.kind === "newsletter"
                  ? "newsletter_signup"
                  : "support_request",
            }),
          );
          form.reset();
        }
        status.dataset.state = "success";
      } catch {
        status.textContent =
          "We couldn’t submit this. Your details are still here. Try again, or email info@afterhoursagenda.com.";
        status.dataset.state = "error";
      } finally {
        form.removeAttribute("aria-busy");
        submit.disabled = false;
        status.focus();
      }
    });
  }
}
