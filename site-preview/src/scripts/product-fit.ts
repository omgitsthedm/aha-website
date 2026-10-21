import { query, queryAll } from "./dom";
import type { Fit, SizeRow } from "./fit";
import { fitSummary } from "./fit-summary";

/** The comparison dialog is downloaded only when Find my size is used. */
export function createFitDialog(form: HTMLFormElement, refresh: () => { fit: Fit | null; pick: SizeRow | null }, saveFit: (fit: Fit | null) => void) {
  const element = document.createElement("dialog");
  element.className = "fit-dialog";
  element.setAttribute("aria-labelledby", "fit-title");
  element.append(query<HTMLTemplateElement>(document, "#fit-content")!.content.cloneNode(true));
  document.body.append(element);
  const drawing = query(document, ".measure-diagram")?.cloneNode(true) as SVGElement | undefined;
  if (drawing) {
    drawing.removeAttribute("role"); drawing.removeAttribute("aria-labelledby"); drawing.setAttribute("aria-hidden", "true");
    queryAll(drawing, "title, desc").forEach((node) => node.remove());
    query(element, ".fit-form > p")?.before(drawing);
  }
  const fitForm = query<HTMLFormElement>(element, "form")!;
  const result = query<HTMLElement>(element, "[data-fit-result]")!;
  const select = query<HTMLButtonElement>(element, "[data-fit-select]")!;
  const forget = query<HTMLButtonElement>(element, "[data-fit-forget]")!;
  const chestInput = fitForm.elements.namedItem("chest") as HTMLInputElement;
  const lengthInput = fitForm.elements.namedItem("length") as HTMLInputElement;
  let unit = "in";
  const format = (value: number) => String(Math.round(value * 100) / 100);
  const limits = () => unit === "cm" ? { chest: [30.48, 101.6], length: [40.64, 101.6], step: 0.01, label: "centimeters" } : { chest: [12, 40], length: [16, 40], step: 0.25, label: "inches" };
  const toInches = (value: number, from = unit) => from === "cm" ? value / 2.54 : value;
  const fromInches = (value: number) => unit === "cm" ? value * 2.54 : value;
  const setUnit = (next: string, convert = true) => {
    const previous = unit;
    unit = next;
    const range = limits();
    [chestInput, lengthInput].forEach((input, index) => {
      const value = Number(input.value);
      if (convert && input.value.trim() && Number.isFinite(value)) input.value = format(previous === "cm" ? value / 2.54 * (unit === "cm" ? 2.54 : 1) : value * (unit === "cm" ? 2.54 : 1));
      const [min, max] = index ? range.length : range.chest;
      input.min = String(min); input.max = String(max); input.step = String(range.step);
    });
    queryAll<HTMLElement>(element, "[data-fit-unit]").forEach((label) => { label.textContent = range.label; });
  };
  const show = () => {
    const { fit, pick } = refresh();
    result.textContent = fit ? pick ? fitSummary(pick, fit) : "No close width match is available. Compare the chart before choosing a size." : "";
    select.hidden = !pick;
    forget.hidden = !fit;
    if (pick) select.textContent = `Select ${pick.size}`;
    if (fit) { chestInput.value = format(fromInches(fit.chest)); lengthInput.value = format(fromInches(fit.length)); }
  };
  query(element, "[data-fit-close]")!.addEventListener("click", () => element.close());
  element.addEventListener("click", (event) => { if (event.target === element) element.close(); });
  queryAll<HTMLInputElement>(element, 'input[name="unit"]').forEach((input) => input.addEventListener("change", () => setUnit(input.value)));
  setUnit(unit, false);
  fitForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const chest = toInches(Number(chestInput.value));
    const length = toInches(Number(lengthInput.value));
    if (!(chest >= 12 && chest <= 40 && length >= 16 && length <= 40)) { const range = limits(); result.textContent = `Enter both measurements in ${range.label}: chest ${range.chest[0]}–${range.chest[1]}, length ${range.length[0]}–${range.length[1]}.`; return; }
    saveFit({ chest, length });
    document.dispatchEvent(new CustomEvent("aha:fit", { detail: { action: "compare", matched: Boolean(refresh().pick) } }));
    show();
  });
  select.addEventListener("click", () => {
    const { pick } = refresh();
    const input = pick && query<HTMLInputElement>(form, `[data-cart-variant][data-size="${pick.size}"]`);
    if (input) { input.checked = true; input.dispatchEvent(new Event("change", { bubbles: true })); }
    document.dispatchEvent(new CustomEvent("aha:fit", { detail: { action: "select", matched: Boolean(pick) } }));
    element.close();
    input?.focus();
  });
  forget.addEventListener("click", () => { saveFit(null); fitForm.reset(); setUnit("in", false); show(); });
  return Object.assign(element, { refreshView: show });
}
