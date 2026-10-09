// The preserved API handlers use only Web Response and NextResponse.json.
// Keep the portable server adapter independent from the retired Next renderer.
export class NextResponse extends Response {
  static json(value, init) {
    return new NextResponse(JSON.stringify(value), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(new Headers(init?.headers)),
      },
    });
  }
}
export const unstable_cache = (fn) => fn; // Request-time API reads must not depend on a Next cache context.
