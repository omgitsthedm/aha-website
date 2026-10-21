/** Typed DOM lookups shared by the shopping controls. */
export function query<K extends keyof HTMLElementTagNameMap>(root: ParentNode, selector: K): HTMLElementTagNameMap[K] | null;
export function query<T extends Element = Element>(root: ParentNode, selector: string): T | null;
export function query(root: ParentNode, selector: string) { return root.querySelector(selector); }
export const queryAll = <T extends Element = Element>(root: ParentNode, selector: string) => root.querySelectorAll<T>(selector);
