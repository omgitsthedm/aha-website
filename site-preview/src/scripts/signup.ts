// Email sign-up forms. Analytics get the event and the page it came from, never the address.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;
const FAILED = "That didn't go through. Try again, or write to info@afterhoursagenda.com.";

document.querySelectorAll<HTMLFormElement>("[data-signup]").forEach((form) => {
  const status = form.querySelector<HTMLElement>("[data-signup-status]");
  const input = form.querySelector<HTMLInputElement>('input[name="email"]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!status || !input || !button) return;
  const say = (message: string) => { status.textContent = message; };
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = input.value.trim();
    if (email.length > 254 || !EMAIL.test(email)) {
      input.setAttribute("aria-invalid", "true");
      say("Enter a full email address, like name@example.com.");
      input.focus();
      return;
    }
    input.removeAttribute("aria-invalid");
    button.disabled = true;
    say("Signing you up…");
    const source = form.dataset.source ?? "site";
    const company = (form.elements.namedItem("company") as HTMLInputElement | null)?.value ?? "";
    try {
      const response = await fetch("/api/updates/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, source, company }) });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) { say([422, 429, 503].includes(response.status) ? data.error ?? FAILED : FAILED); return; }
      input.value = "";
      form.classList.add("is-done");
      say("You're on the list. We'll write when something new is ready.");
      document.dispatchEvent(new CustomEvent("aha:signed-up", { detail: { source } }));
    } catch {
      say(FAILED);
    } finally {
      button.disabled = false;
    }
  });
});
