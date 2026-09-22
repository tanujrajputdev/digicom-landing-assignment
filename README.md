# Digicom — Landing Page Assignment

A hand-built recreation of selected sections from the Digicom Figma landing page.
No frameworks, no build step, no dependencies — open `index.html` and it runs.

- **Hosted preview:** _pending deploy_
- **Source:** _pending push_

---

## Running it

```bash
# any static server works; the page also opens fine straight from the filesystem
python3 -m http.server 8000
# → http://localhost:8000
```

Run the headless contract test (no dependencies, Node only):

```bash
node test/cart-contract.test.js
# 32 passed, 0 failed
```

It asserts the `/cart/add.js` request shape, both dataLayer payloads, the
once-per-load `view_item` guard, and that the 404 and 422 failure paths push
nothing to the dataLayer.

Scripts are plain classic `<script>` tags rather than ES modules, specifically so
that opening `index.html` directly off the filesystem (`file://`) works without
CORS errors. A reviewer unzipping the submission and double-clicking the file
gets a working page with a clean console.

---

## Sections built

| # | Section | Required |
|---|---------|----------|
| 1 | Hero | mandatory |
| 2 | Product — gallery, variant picker, quantity, add to cart | mandatory |
| 3 | Comparison table | mandatory |
| 4 | FAQ accordion | chosen |
| 5 | How It Works — 4 steps | chosen |

The trust bar under the hero is included as well; at 69px it is too small to
count as one of the five, but the hero reads wrong without it.

Source design: `VoChill - Multi variant LP`, node `1:5` — a 1600 x 8484 frame.

---

## File layout

```
index.html
css/
  tokens.css        design tokens lifted from Figma (type scale, colour, spacing)
  base.css          reset + element defaults
  sections.css      per-section layout
  responsive.css    mobile/tablet adaptation
js/
  config.js         USE_MOCK_CART switch, currency, page-variation resolver
  product-data.js   the product object (+ the Liquid that would replace it)
  analytics.js      dataLayer, view_item, add_to_cart
  cart-api.js       Shopify AJAX Cart API request logic
  cart-mock.js      fetch-shaped mock transport (demo only)
  gallery.js        product image gallery
  accordion.js      FAQ accordion
  main.js           bootstrap + wiring
assets/images/      exported from Figma
```

---

## Gallery and accordion

Both are written from scratch; no slider or accordion library is used.

**Gallery** (`js/gallery.js`) — thumbnail rail drives a main stage image.
Click, arrow keys, `Home`/`End`, and horizontal swipe all navigate. The thumb
strip uses a roving `tabindex` so the gallery is a single tab stop, and every
image is preloaded on init so switching never flashes or shifts layout.

**Accordion** (`js/accordion.js`) — `aria-expanded`, `aria-controls`,
`role="region"` and `aria-labelledby` are wired at runtime, with ids generated
if the markup doesn't supply them. `ArrowUp`/`ArrowDown`/`Home`/`End` move
between headers. Panels animate via measured `max-height`, which is released to
`none` on `transitionend` so an open panel can still reflow (font swap, resize)
without clipping. Respects `prefers-reduced-motion`.

---

## Simulated add to cart

The requirement is to show the *intended* Shopify integration, so the request
logic and the mock live in separate files and neither imports the other.

**`js/cart-api.js`** is what would ship to a live storefront, unchanged:

```js
send('/cart/add.js', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  body: JSON.stringify({ items: [{ id: variantId, quantity: quantity }] })
})
```

It takes a `transport` argument with the same signature as `window.fetch`, and
falls back to `window.fetch` when none is passed. It has no knowledge that a
mock exists. Non-2xx responses are parsed and rethrown as a `CartError`
carrying Shopify's `status` / `message` / `description`.

**`js/cart-mock.js`** implements that same fetch contract — it returns a promise
of an object with `.ok`, `.status` and `.json()`. It simulates latency and
returns realistic payloads: a Shopify line item on success (prices as integer
minor units, `variant_id`, `key`, `line_price`), a `422` when quantity exceeds
inventory, and a `404` for an unknown variant.

**Going live** is one line in `js/config.js`:

```js
USE_MOCK_CART: false   // cart-api.js now calls window.fetch against the real store
```

…plus replacing `js/product-data.js` with the Liquid block quoted at the top of
that file, which renders the real product and variant ids into the page.

---

## dataLayer events

`window.dataLayer` is initialised in `js/analytics.js` before anything can push
to it. Both events use GA4 ecommerce shape, and each push is preceded by
`dataLayer.push({ ecommerce: null })` so fields from the previous event can't
leak into the next one.

Every payload carries `page_variation` — the displayed page variation, resolved
from `?variation=` and defaulting to `control` — so events can be split by
experiment arm downstream.

### `view_item`

Fires **once per page load**, when the product section first becomes visible.
An `IntersectionObserver` at a 0.25 visibility threshold watches the product
section and `disconnect()`s the moment it fires; a module-level flag in
`analytics.js` guards the event a second time, so the event is safe even if the
observer is rebound.

```js
{
  event: 'view_item',
  page_variation: 'control',
  ecommerce: {
    currency: 'USD',
    value: 129.00,
    items: [{
      item_id: '45329087452193',
      item_name: 'Product name',
      item_brand: 'Digicom',
      item_variant: 'Variant title',
      price: 129.00,
      quantity: 1,
      currency: 'USD'
    }]
  }
}
```

### `add_to_cart`

Fires **only after the cart request resolves successfully** — it lives inside
the `.then()` of the settled promise, never on button click and never
optimistically. A failed add takes the `.catch()` branch, renders an inline
error, and pushes nothing.

`value` is the line total (unit price × quantity), not the unit price.

```js
{
  event: 'add_to_cart',
  page_variation: 'control',
  event_id: '9f1c2f7e-...',        // deduplication key, see below
  ecommerce: {
    currency: 'USD',
    value: 258.00,                 // 129.00 × 2
    items: [{
      item_id: '45329087452193',
      item_name: 'Product name',
      item_brand: 'Digicom',
      item_variant: 'Variant title',
      price: 129.00,               // unit price
      quantity: 2,
      currency: 'USD'
    }]
  }
}
```

---

## Tracking explanation

### Mapping `add_to_cart` to Meta `AddToCart`

A GTM Custom HTML (or Meta Pixel) tag fires on the `add_to_cart` Custom Event
trigger and reads from the same dataLayer object:

| dataLayer path | Meta parameter | Notes |
|---|---|---|
| `ecommerce.items[].item_id` | `content_ids` | array, one entry per line item |
| `ecommerce.items[]` `{item_id, quantity}` | `contents` | `[{ id, quantity }]` — carries quantity, which `content_ids` cannot |
| `ecommerce.items[].item_name` | `content_name` | |
| `ecommerce.value` | `value` | line total, numeric, never a formatted string |
| `ecommerce.currency` | `currency` | ISO-4217, must accompany `value` |
| — | `content_type` | constant `'product'` |
| `event_id` | `eventID` | dedup key, see below |

```js
fbq('track', 'AddToCart', {
  content_type: 'product',
  content_ids:  items.map(i => i.item_id),
  contents:     items.map(i => ({ id: i.item_id, quantity: i.quantity })),
  content_name: items[0].item_name,
  value:        ecommerce.value,
  currency:     ecommerce.currency
}, { eventID: event_id });
```

**The ID detail that actually matters.** `content_ids` has to match the `id`
column of the Meta product catalog, or Advantage+ catalog ads and dynamic
retargeting silently fail to match — the events land, the attribution doesn't.
Shopify's Meta sales channel feeds the catalog using the **variant** id, so this
implementation sends `variant_id`, not `product_id`. Some feeds instead
namespace it as `shopify_<country>_<product_id>_<variant_id>`. Before shipping,
open Commerce Manager → Catalog → Items, copy one real id, and confirm the
format matches what the pixel sends.

### Verifying it fires correctly

1. **GTM Preview** — add to cart, confirm exactly one `add_to_cart` message in
   the timeline, the Meta tag fired on it, and the Variables tab resolves
   `value`, `currency` and `content_ids` to real values rather than `undefined`.
2. **Meta Pixel Helper** — confirms `AddToCart` with its parameters in-page.
3. **Events Manager → Test Events** — the authoritative check. Meta shows the
   received payload and flags missing or malformed parameters, which Pixel
   Helper does not.
4. **Network tab** — filter `facebook.com/tr`, look for `ev=AddToCart` and read
   `cd[value]`, `cd[currency]`, `cd[content_ids]` off the query string.
5. **Negative tests, the ones usually skipped:**
   - set `config.mock.failForVariantId` to force a 422 → the error renders and
     **no** `add_to_cart` is pushed;
   - double-click the button → one event, not two (the handler guards on
     `isSubmitting`);
   - reload and scroll past the product section twice → `view_item` once.
6. **Events Manager → Diagnostics** a day later, for `value`/`currency` type
   warnings that only surface at volume.

### Preventing duplicates if Meta tracking already exists

Shopify stores almost always already fire `AddToCart` — from the native Meta
sales channel, a theme app extension, or a hardcoded pixel in `theme.liquid`.
Adding a second sender double-counts, which inflates ATC volume, halves
reported cost-per-ATC and corrupts the optimisation signal.

**First, audit.** Pixel Helper shows every pixel on the page and every event
each one sends; Events Manager flags overlapping events. Establish what already
fires before adding anything.

**Then pick one of three, in order of preference:**

1. **One sender.** If Shopify's native Meta channel already sends `AddToCart`
   with a correct catalog id, don't send a second. Use the dataLayer event for
   GA4 only. Fewest moving parts, nothing to drift.
2. **Disable the incumbent.** If the existing event is wrong — missing `value`,
   wrong id format — turn it off at its source (Meta channel settings, or
   remove the theme snippet) and let this implementation own the event. Never
   leave both on with the intention of "filtering later."
3. **Deduplicate explicitly** when both browser and server must send — the
   normal case once Conversions API is in play. Meta drops a duplicate when
   **`event_name` + `event_id`** match within its dedup window, so the same
   `event_id` must ride on both. That is why `analytics.js` generates one
   `event_id` per successful add and puts it in the dataLayer payload: the
   pixel sends it as `eventID`, and the CAPI call sends the identical value as
   `event_id`. Generating it at send time on each side instead — a common
   mistake — produces two different ids and defeats the whole mechanism.

**One more guard at the trigger level.** Bind the tag to the `add_to_cart`
Custom Event, never to a generic click trigger on the button. A click trigger
fires on *attempts*, so it double-counts retries and records conversions for
adds that failed. Firing off the dataLayer event means the event can only exist
downstream of a successful cart response.

---

---

## Fidelity notes

Typography and colour were read off the Figma nodes rather than eyeballed:
**Cormorant** for display, **Inter** for UI and body, **Nunito** for the ADD TO
CART label, the step badges and the dark section's body copy — all three
self-hosted as variable fonts (119KB total), so the page makes no third-party
requests and renders identically offline.

Two places where the design is internally inconsistent, and what I did:

- The product block shows **$80.92 / $89.95 / Save $8.98**, but 89.95 − 80.92
  is **$9.03**. The saving is computed from the two prices at runtime so the
  three numbers always agree. Changing a price in `product-data.js` cannot
  desync the badge.
- The style tab reads *Stemless* while the title reads *Stemmed Wine Chiller
  Pair*. I defaulted to **Stemless / Couple Pair**, which is the combination
  whose price ($80.92) the design actually displays.

The Figma gallery is a single static image, so the working gallery is built
from the design's own product renders (main shot, the two style shots, the
cradles shot, and the hero lifestyle photo). The rail is rebuilt when the
shopper switches style.

---

## Browsers and screen sizes tested

**Verified** — Chrome 153 on macOS (headless, driven over the DevTools
Protocol). Tested at **320, 360, 390, 414, 480, 540, 640, 720, 768, 800, 820,
860, 900, 1024, 1180, 1280, 1440, 1600 and 1920px**: no horizontal overflow at
any width, and zero console messages, exceptions or failed requests across the
whole sweep.

Interaction paths verified in-browser: gallery thumb + arrows + style rebuild,
accordion single-open, variant and pack switching, quantity clamping to
inventory, the full add-to-cart round trip, and the double-click guard.

**Not verified** — Safari and Firefox were not available in this environment, so
they are untested rather than known-good. The layout leans on `:has()`,
`aspect-ratio`, `clamp()` and `text-wrap: balance`; all four are supported in
current Safari and Firefox, but I would want to confirm on real builds before
calling it done. `:has()` is the one worth checking first — it carries the
selected state on the variant chips, so a failure there would be visible rather
than cosmetic.

Automated checks that ship with the repo: a 32-assertion headless contract test
covering the `/cart/add.js` request shape, both dataLayer events and the 404 /
422 failure paths.

## Time spent

About 40 minutes of build time end to end (09:57–10:36), from an empty directory to the
deployed page — design extraction, build, browser verification and this
document. Adjust this line if you would rather count it differently.

## Unfinished / known gaps

- **Safari and Firefox are untested** (see above). This is the gap I would close
  first.
- **Four of the nine sections were not built** — the problem section, the
  reviews grid, "The Real Difference", and the floating testimonial card. The
  brief asked for five; I built five plus the trust bar.
- **The cart is write-only.** There is no cart drawer, line-item list or
  running total — the request succeeds, fires its event and reports inline.
  Nothing accumulates, because the brief scoped this to the add-to-cart call.
- **Colour has one option (Quartz)**, as in the design. The option group is
  modelled as a real third Shopify option, so more colours are data, not code.
- **No automated accessibility audit.** Semantics were built in deliberately —
  radio groups for options, a real `<table>` for the comparison, generated
  `aria-expanded`/`aria-controls`, roving tabindex, a skip link, `role="status"`
  on the cart message — but I did not run axe or a screen reader over it.
- **`preload` covers only Inter and Cormorant**, not Nunito, which is used
  below the fold.
