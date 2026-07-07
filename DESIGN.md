# DESIGN.md — Coverage Copilot UI

The design language is **liquid glass**: translucent, blurred surfaces that let the background show
through, with a bright specular rim on the top edge and a soft drop shadow for depth. Reference the
working file `glass-design-system.html` for exact values and live components — it is the source of
truth. This doc is the rulebook.

> Build UI to match this. When you deviate for a good reason (usually legibility or accessibility),
> say so, per CLAUDE.md §2.

---

## 1. The two glass surfaces

There are **two** glass treatments. Do not use the translucent one for long-form reading.

- **Chrome glass** (`.glass`) — navbar, cards, buttons, toggles, chips, overlays, short text.
  More transparent; the effect is the point.
- **Reading glass** (`.reading` / `--glass-bg-solid`) — coverage answers, policy text, anything the
  owner reads at length. **More opaque** so text stays legible over a busy background. Legibility
  wins over the effect here, always.

## 2. Mode rules

- **Dark mode:** grey-tinted transparent glass — `rgba(28,32,38,0.55)`.
- **Light mode:** near-white transparent glass — `rgba(255,255,255,0.55)`.
- Both driven by CSS variables and a `data-theme` attribute on `<html>` (`"dark"` | `"light"`).
- Every color comes from a token. No hardcoded hex in components.

## 3. The glass recipe (apply to every glass surface)

```css
background: var(--glass-bg);
backdrop-filter: blur(24px) saturate(180%);
border: 1px solid var(--glass-border);
box-shadow: var(--glass-shadow), inset 0 1px 0 var(--glass-rim); /* rim = the top-edge highlight */
```

The `inset 0 1px 0` rim highlight is what makes it read as glass rather than a flat translucent
box — never omit it. Glass **must** sit over something with visual depth (a photo, gradient, or
other content); over a flat fill the blur does nothing.

## 4. Tokens (see the HTML file for the full set)

- Radii: pill `999px` (nav, switches, chips, segmented, input), cards `24px`, controls `16px`.
- Blur `24px`, saturate `180%`. Easing `cubic-bezier(.32,.72,0,1)`.
- Accent: cyan-teal (`hsl(190 90% 55%)`) — calm and trustworthy, glows well on glass; used for
  primary actions and "on" states only. It is deliberately **not** default corporate blue.
- Severity: low = green, medium = amber, high = red — **always paired with an icon and a text
  label. Never encode severity with color alone** (accessibility; matches CLAUDE.md §4.4).

## 5. Components (all in the reference file)

- **Navbar:** glass pill; active item widens and gets a lighter fill + rim; unread = small glowing dot.
- **Cards:** glass, icon tile + title + timestamp + short message (like the reference tray).
- **Buttons:** `primary` (accent gradient, glows), default (neutral glass), `ghost` (transparent).
- **Toggle/switch:** glass track, white thumb with its own rim, accent gradient track when on.
- **Segmented control, input field, severity chips:** all glass, all in the reference.

## 6. Motion

- Subtle and functional: press = slight scale-down (`.94–.97`), state changes ease over ~.3s.
- Stream coverage answers in (matches CLAUDE.md §4.3). Avoid decorative/ambient animation — it
  reads as unfinished and hurts a high-stakes product's credibility.

## 7. Accessibility (required — this audience is non-technical and broad)

- Maintain WCAG AA contrast for all text **including over glass**; if a background image would drop
  contrast below AA, darken/lighten the scrim behind the glass or switch that surface to reading glass.
- Honor `prefers-reduced-transparency`: drop the blur and use near-solid backgrounds (handled in the
  reference file).
- Honor `prefers-reduced-motion`: disable transitions.
- Visible keyboard focus on every interactive element (accent outline, already in the reference).
- Never rely on color alone to convey meaning (severity, status).

## 8. Copy voice (from CLAUDE.md §4.2)

Plain language for a busy owner. Buttons say what happens ("Start risk review", not "Submit").
Actions keep the same name through the flow. Errors explain what happened and the fix; empty states
invite an action. No jargon without an inline explanation.
