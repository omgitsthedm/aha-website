# Theming — swap the whole design system

The visual layer is a **token contract**. Every color the site uses resolves (through Tailwind and CSS-var aliases) to a small set of **channel tokens** defined in `app/globals.css`. Change the channels → the whole site re-themes. Components don't need to change.

## The contract (channels, `R G B`)
Defined in `app/globals.css` `:root` (the default "blacklight" theme):

```
--c-bg --c-bg-deep --c-charcoal --c-surface --c-surface-warm --c-elevated --c-navy   (surfaces)
--c-content --c-muted --c-concrete                                                    (text)
--c-gold --c-rust                                                                     (warm accents)
--c-lime --c-cyan --c-pink --c-green --c-purple --c-magenta --c-sun --c-orange
--c-line-green --c-line-purple                                                        (bright accents)
```

Values are space-separated RGB channels (e.g. `--c-bg: 16 16 15;`) so Tailwind opacity modifiers work: `bg-void/50` → `rgb(var(--c-bg) / .5)`.

## How it's wired
- **Tailwind** (`tailwind.config.js`): every color = `rgb(var(--c-*) / <alpha-value>)`. So `bg-void`, `text-cream`, `text-line-yellow`, `border-border`, etc. all read the channels.
- **Direct CSS** (`--aha-*` aliases): kept for components/globals that use `var(--aha-void)` — each is now `rgb(var(--c-*))`, so it themes too.
- **Non-color tokens**: `--aha-font-display/body/mono`, `--aha-radius`, `--aha-border`, `--aha-space-*`, `--aha-motion-*`, `--aha-tap-min`, `--aha-z-*` (also in `:root`).

## Add a new design system (no component edits)
1. Copy the `[data-theme="paper"]` block in `app/globals.css`, rename it (e.g. `[data-theme="neo"]`), and set the channel values for your new palette. Override fonts/radius/border there too if the system needs it.
2. Activate it one of two ways:
   - Global: set env `NEXT_PUBLIC_AHA_THEME=neo` (drives `<html data-theme>` in `app/layout.tsx`).
   - Per-scope: put `data-theme="neo"` on any element to theme a subtree (great for previewing).
3. Deploy. Done — every surface, button, badge, and accent re-skins.

## What still needs a component touch
Anything that hard-codes a raw hex in a `className` (e.g. `text-[#CCFF00]`) or inline style won't follow the theme. Migrate those to a token utility (`text-line-yellow`) or `var(--aha-*)` as you touch them. The token classes cover the bulk of the UI already.

## Rules
- Never add a raw hex to a component — use a Tailwind token color or `var(--aha-*)`.
- New brand colors → add a channel token to the contract first, then reference it.
- Keep contrast AA in every theme (checked at the token level).
