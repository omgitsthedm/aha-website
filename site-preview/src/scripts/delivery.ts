// Delivery estimates from src/data/delivery.json, in the visitor's own calendar.
import plan from "../data/delivery.json" with { type: "json" };

const closed = new Set(plan.closedDates);
const iso = (day: Date) => `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
const working = (day: Date) => day.getDay() % 6 !== 0 && !closed.has(iso(day));
const startOfDay = (day: Date) => new Date(day.getFullYear(), day.getMonth(), day.getDate());
const parse = (value: string) => { const [y, m, d] = value.split("-").map(Number); return new Date(y!, m! - 1, d!); };

export function addBusinessDays(start: Date, days: number) {
  const day = startOfDay(start);
  for (let left = days; left > 0;) { day.setDate(day.getDate() + 1); if (working(day)) left -= 1; }
  return day;
}

/** Earliest and latest U.S. arrival for an order placed (or paid) on `from`. */
export function arrivalWindow(from = new Date()) {
  const [productionMin, productionMax] = plan.productionBusinessDays as [number, number];
  const [shippingMin, shippingMax] = plan.domesticShippingBusinessDays as [number, number];
  return { earliest: addBusinessDays(from, productionMin + shippingMin), latest: addBusinessDays(from, productionMax + shippingMax + plan.bufferBusinessDays), shipsBy: addBusinessDays(from, productionMax) };
}

/** The last day to order for delivery by the holiday date, while the holiday notice is showing. */
export function holidayCutoff(from = new Date()) {
  const today = startOfDay(from);
  const deliverBy = parse(plan.holiday.deliverBy);
  if (today < parse(plan.holiday.showFrom) || today > deliverBy) return null;
  for (let day = new Date(deliverBy); day >= today; day.setDate(day.getDate() - 1)) {
    if (working(day) && arrivalWindow(day).latest <= deliverBy) return { orderBy: new Date(day), label: plan.holiday.label };
  }
  return { orderBy: null, label: plan.holiday.label };
}

export const formatDay = (day: Date) => day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Customer-facing lines: the arrival window and, in season, the order-by date. */
export function deliveryLines(from = new Date()) {
  const { earliest, latest } = arrivalWindow(from);
  const lines = [`Estimated U.S. arrival: ${formatDay(earliest)} – ${formatDay(latest)}`];
  const holiday = holidayCutoff(from);
  if (holiday?.orderBy) lines.push(`Order by ${formatDay(holiday.orderBy)} for U.S. delivery by ${holiday.label}.`);
  else if (holiday) lines.push(`Orders placed now are expected to arrive after ${holiday.label}.`);
  return lines;
}
