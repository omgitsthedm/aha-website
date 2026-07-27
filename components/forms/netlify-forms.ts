/**
 * Shared submission path for every Netlify-backed form on the site.
 *
 * The endpoint is `/__forms.html` and must never be `/`. POSTing to `/` hits the
 * Next.js homepage route, which answers 200 with the rendered homepage, so a
 * `response.ok` check passes and the form reports success for a submission that
 * was never stored. `/__forms.html` has no Next.js route and no POST handler, so
 * a 2xx there can only come from Netlify's form handler — which turns the status
 * check into real verification instead of a guess.
 *
 * While site-level form detection is off (Site configuration -> Forms -> Form
 * detection), this endpoint answers non-2xx, `submitNetlifyForm` throws, and the
 * caller shows its error state. That is the correct behaviour: nothing is
 * stored, so nothing may claim to have been stored.
 */
export const NETLIFY_FORM_ENDPOINT = "/__forms.html";

/**
 * Serialises a form and posts it to the Netlify form handler.
 * Resolves only on a verified 2xx; throws on anything else.
 */
export async function submitNetlifyForm(form: HTMLFormElement): Promise<void> {
  const body = new URLSearchParams();
  for (const [key, value] of new FormData(form).entries()) {
    if (typeof value === "string") body.append(key, value);
  }
  const response = await fetch(NETLIFY_FORM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!response.ok) throw new Error(`Netlify Forms did not accept the submission (${response.status})`);
}
