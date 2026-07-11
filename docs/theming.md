# AHA Theme Contract

The storefront has one governed visual theme: Black Sheep Newsstand. Runtime theme switching is not a current product requirement. The `data-theme` attribute remains only as a stable document hook.

## Semantic channels

The RGB channels in `app/globals.css` support Tailwind opacity modifiers:

```text
--c-bg
--c-charcoal
--c-surface
--c-content
--c-muted
--c-accent
--c-success
--c-warning
--c-error
```

`tailwind.config.js` maps those channels to `void`, `charcoal`, `surface`, `cream`, `border`, `muted`, `accent`, `success`, `warning`, and `danger`.

## Rules

- Do not put raw color values in React components.
- Use `accent` only for brand focus, primary actions, and selected state.
- Use success, warning, and danger only for their named functional state.
- Use border opacity for quiet rules; do not create extra neutral colors for each component.
- Validate text, focus, control, and state contrast before changing a channel.
- A new theme requires a documented product reason and a full route and state matrix. It is not a component-level styling shortcut.

See `docs/design-tokens.md` and `docs/AHA-UIUX-SYSTEM-V3.md` for the complete contract.
