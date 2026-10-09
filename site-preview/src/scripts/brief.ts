type Values = Record<string, unknown>;
const text = (value: unknown, limit: number) =>
  String(value ?? "")
    .trim()
    .slice(0, limit);
export function validateBrief(values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  if (text(values.name, 80).length < 2)
    errors.name = "Add your name so we know who we’re talking to.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(values.email, 160)))
    errors.email = "Use an email address like you@example.com.";
  if (text(values.message, 1800).length < 10)
    errors.message = "Add a short sentence about what you need help with.";
  return errors;
}
export function createBrief(values: Values) {
  const labels: Record<string, string> = {
    order: "Existing order",
    product: "Product or fit question",
    returns: "Return or quality question",
    accessibility: "Accessibility issue",
    general: "General question",
  };
  const topic = labels[text(values.topic, 30)] || "General question";
  const body = `Hi After Hours Agenda,\n\n${topic}\n\n${text(values.message, 1800)}\n\nName: ${text(values.name, 80)}\nOrder number: ${text(values.reference, 120) || "Not provided"}\nReply to: ${text(values.email, 160)}\n`;
  const subject = `${topic} · ${text(values.name, 80)}`;
  return {
    body,
    url: `mailto:info@afterhoursagenda.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
