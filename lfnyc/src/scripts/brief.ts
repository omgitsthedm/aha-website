type Values = Record<string, unknown>;
const text = (value: unknown, limit: number) =>
  String(value ?? '')
    .trim()
    .slice(0, limit);
export function validateBrief(values: Values): Record<string, string> {
  const errors: Record<string, string> = {};
  if (text(values.name, 80).length < 2)
    errors.name = 'Add your name so we know who we’re talking to.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(values.email, 160)))
    errors.email = 'Use an email address like you@yourbusiness.com.';
  if (text(values.message, 1800).length < 10)
    errors.message = 'Add a short sentence about what you need help with.';
  return errors;
}
export function createBrief(values: Values) {
  const labels: Record<string, string> = {
    websites: 'Custom website',
    'tech-support': 'Tech support',
    'business-systems': 'Software you own',
    consulting: 'Free second opinion',
  };
  const service = labels[text(values.service, 30)] || 'Free second opinion';
  const body = `Hi Little Fight,\n\nI’d like help with: ${service}.\n\n${text(values.message, 1800)}\n\nName: ${text(values.name, 80)}\nBusiness: ${text(values.business, 120) || 'Not provided'}\nReply to: ${text(values.email, 160)}\n`;
  const subject = `${service} · ${text(values.business, 80) || text(values.name, 80)}`;
  return {
    body,
    url: `mailto:hello@littlefightnyc.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  };
}
