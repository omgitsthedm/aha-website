import { getContext } from "@netlify/functions";
import type { FormSubmittedEvent } from "@netlify/functions";
import { getDatabase } from "@netlify/database";
import { production, emailValue } from "../../server/runtime.ts";
import { subscribeInDatabase } from "../../server/preferences.ts";
export default {
  async formSubmitted(event: FormSubmittedEvent) {
    const context = getContext();
    if (!production(context)) return;
    const data = event.data;
    if (
      data["marketing-consent"] !== "yes" ||
      data.list !== "aha-newsletter-2026"
    )
      return;
    const email = emailValue(data.email);
    if (!email) return;
    await subscribeInDatabase(getDatabase().sql, email);
    // Capture and consent only: no unrequested marketing/welcome send from a form hook.
  },
};
