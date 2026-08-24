import { describe, expect, it, vi } from "vitest";
import { focusModalTarget, trapModalFocus } from "@/components/product/SizeGuideModal";
import { nextZoomState, zoomOriginForActivation } from "@/components/product/ImageLightbox";

describe("product modal accessibility", () => {
  it("focuses the dialog target and wraps Tab in both directions", () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const preventDefault = vi.fn();

    focusModalTarget(first);
    expect(first.focus).toHaveBeenCalledOnce();

    expect(trapModalFocus({ key: "Tab", shiftKey: false, preventDefault }, last, [first, last])).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledTimes(2);

    expect(trapModalFocus({ key: "Tab", shiftKey: true, preventDefault }, first, [first, last])).toBe(true);
    expect(last.focus).toHaveBeenCalledOnce();
  });

  it("preserves normal navigation for non-boundary modal keys", () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const preventDefault = vi.fn();

    expect(trapModalFocus({ key: "Escape", shiftKey: false, preventDefault }, first, [first, last])).toBe(false);
    expect(trapModalFocus({ key: "Tab", shiftKey: false, preventDefault }, first, [first, last])).toBe(false);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("centers keyboard zoom and reports an accurate toggle state", () => {
    const rect = { left: 10, top: 20, width: 200, height: 100 };
    expect(zoomOriginForActivation({ detail: 0, clientX: 0, clientY: 0, rect })).toEqual({ x: 50, y: 50 });
    expect(zoomOriginForActivation({ detail: 1, clientX: 110, clientY: 70, rect })).toEqual({ x: 50, y: 50 });
    expect(nextZoomState({ on: false, x: 50, y: 50 }, { x: 50, y: 50 })).toEqual({ on: true, x: 50, y: 50 });
    expect(nextZoomState({ on: true, x: 10, y: 20 }, { x: 40, y: 60 })).toEqual({ on: false, x: 50, y: 50 });
  });
});
