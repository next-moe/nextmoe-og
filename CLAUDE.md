# Project Guidelines

## 铁律 (Iron Rules — non-negotiable; these override every other guideline in this file)

1. **No gradient backgrounds anywhere** — not in cards, not in a future preview page (`linear-gradient()`, `radial-gradient()`, `conic-gradient()`, etc.). Solid colors from the `palette` in `src/templates/layout.ts` only.
2. **The corner wordmark is exactly `NextMoe·未萌`.** Casing is `NextMoe` — capital N, capital M, lowercase everything else, the `t` included. Never `nextmoe`, `Nextmoe`, `NexMoe` or `NextMoe · 未萌` (no spaces, U+00B7 middle dot). It appears once per card, small, in the meta bar — never enlarged into the subject of the card.
3. **This service never touches a database.** It is a pure function `{ template, fields, images } -> image bytes`. All data comes from the caller; correctness of that data is the caller's problem. No cross-repo data fetching, no callbacks to sites, no second data-aggregation layer.

## Core Engineering Principles

> Shared baseline across all KUN Galgame repositories. Defaults, not dogma — apply judgment.

1. All commit messages must be written entirely in English.
2. Comments are governed by the **Comments** section below — the default is none, and what survives is written in English.
3. Keep each source file under ~500 lines where practical; past ~300 lines, consider splitting (guideline, not hard rule).
4. Write every function as an arrow function; do not declare with the `function` keyword.
5. Deliberately balance elegant modularity against necessary duplication — choose per case.
6. After every change, watch for unintended side effects elsewhere.
7. Always seek the most modern, elegant solution that fits the project's current state; don't let that pursuit make the code complex, and don't write over-defensive code.
8. **Pushing and deploying are the user's decisions.** Commit locally; never push unless told to.

## Who designs the cards: downstream does

The ideal end state is that **the vast majority of OG cards are customized by the downstream sites**. This service owns the machinery — signing, cache, queue, font registration, remote-image pre-fetch — plus the shared skeletons (`splitCard` / `bannerCard`), the palette, and the wordmark. What a card says, which fields it carries, and most of how a given template looks is the consuming site's call.

Practically:

- When a site wants a different look, add or extend a template for it. Do not bend every site into one central design, and do not reject a template because it deviates from an existing one.
- Keep site-specific assumptions out of `src/render/`, `src/cache/`, `src/security/` — those layers must stay template-agnostic. Site flavor lives only under `src/templates/`.
- What is _not_ downstream-customizable: the three iron rules above, the 1200×630 default size, and `escapeHtml` on every interpolated field.
- Consumer scope is the four sites in README (patch, letmoe, kungal forum, infra console) — do not add others and do not pre-provision for others.

## takumi traps (each of these already cost a debugging session)

- **Fonts are always self-supplied.** takumi reads no system fonts; without registration only built-in Latin Geist exists and CJK renders as tofu. `pnpm fonts` fetches 28 MiB of Noto (never committed); missing files fail renderer startup on purpose. Variable-font `wght` is honored — one file per family yields real bold, so never download static weights.
- **`display: -webkit-box` throws `InvalidArg`.** Multi-line truncation is bare `line-clamp: N` — use the `clamp()` helper from `layout.ts`, never hand-write the -webkit- stack.
- **Never let takumi fetch a remote image itself.** Its internal fetch has hardcoded `throwOnError: true` and no timeout: one dead cover URL kills the whole render and can hang for seconds. All remote images go through `src/render/images.ts` (own timeout + size cap), get passed as bytes via `images: []`, and fall back to the lettermark block on failure. A template's `html()` must only emit `<img src>` for URLs present in the `loaded` set it receives.
- **Keep `emoji: 'from-font'`.** The default `twemoji` mode downloads emoji PNGs from a CDN on every render.
- JP vs SC glyph shape is chosen per field via `fontStack.jp` / `fontStack.sc` — Japanese titles use the JP-first stack, Chinese text the SC-first stack. Do not set one global CJK font order.

## Layout of the code

- `src/server.ts` boot; `src/routes/` HTTP faces; `src/security/signature.ts` HMAC for signed GET; `src/cache/` disk + optional Redis + single-flight; `src/render/` engine, fonts, image pre-fetch; `src/templates/` the cards.
- A new template = one file in `src/templates/` exporting a `Template<F>` (see `types.ts`), registered in `src/templates/index.ts`. Reuse `layout.ts` skeletons and helpers before inventing new ones.
- Signed URLs are immutable by construction (cache key = hash of template + payload); there is no invalidation protocol. Never add one — changed data means a changed URL.

## Comments

**Default: none.** A comment is earned by a mistake that already happened — an agent or person got it wrong, a review caught it, a render broke — and records the wrong conclusion so the next reader doesn't reach it again. If you cannot name the incident, there is no comment to write. The standing exception is a constraint that is true but invisible from the file (an upstream takumi quirk, a version floor). Write the conclusion, not the mechanism; English, and short. Never write restatements, section banners, or `TODO` without an owner.

## Local development

```bash
pnpm install
pnpm fonts                 # 28 MiB Noto into assets/fonts/, gitignored
cp .env.example .env       # at least change OG_SITE_KEYS
pnpm dev                   # :3300
```

Redis is optional — empty `REDIS_URL` runs disk-only. `pnpm sign <template> <secret> '<json>'` produces a signed URL to curl; POST with `Authorization: Bearer <secret>` renders without a signature (prewarm/preview). `pnpm typecheck` before committing.
