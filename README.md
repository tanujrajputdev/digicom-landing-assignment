# VoChill Landing Page

A build of six sections from the Digicom Figma file, in vanilla HTML, CSS and
JavaScript. No frameworks, no build step, no runtime dependencies.

- **Live preview:** https://assignment-tanuj-s-projects11.vercel.app
- **Mirror:** https://tanujrajputdev.github.io/digicom-landing-assignment/
- **Source:** https://github.com/tanujrajputdev/digicom-landing-assignment
- **Cart inspector:** add `?debug=1` to the preview URL

Source design: `VoChill - Multi variant LP`, node `1:5`, a 1600 × 8484 frame.

---

## Tracking explanation

### Mapping `add_to_cart` to Meta `AddToCart`

A GTM tag fires on the `add_to_cart` Custom Event trigger and reads the same
dataLayer object the page pushes.

| dataLayer | Meta parameter | Note |
|---|---|---|
| `items[].item_id` | `content_ids` | array, one entry per line item |
| `items[]` id + qty | `contents` | carries quantity, which `content_ids` cannot |
| `items[].item_name` | `content_name` | |
| `ecommerce.value` | `value` | line total, numeric, never a formatted string |
| `ecommerce.currency` | `currency` | ISO-4217, must accompany `value` |
| — | `content_type` | constant `'product'` |
| `event_id` | `eventID` | deduplication key, see below |

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

**The ID detail that matters.** `content_ids` has to match the ID column of the
Meta product catalog, or dynamic retargeting silently fails to match: the events
land, the attribution doesn't. Shopify's Meta sales channel feeds the catalog
using the **variant** ID, so this sends `variant_id`, not `product_id`. Some
feeds namespace it as `shopify_<country>_<product_id>_<variant_id>` instead.
Before shipping, open Commerce Manager, copy one real ID, and confirm the format
matches what the pixel sends.

### Verifying it fires correctly

1. **GTM Preview** — one `add_to_cart` message per add, the Meta tag fired on it,
   and the Variables tab resolving `value`, `currency` and `content_ids` to real
   values rather than `undefined`.
2. **Meta Pixel Helper** — confirms `AddToCart` and its parameters in-page.
3. **Events Manager → Test Events** — the authoritative check. Shows the received
   payload and flags malformed parameters that Pixel Helper does not.
4. **Network tab** — filter `facebook.com/tr`, read `ev=AddToCart` and
   `cd[value]`, `cd[currency]`, `cd[content_ids]` off the query string.
5. **The negative tests**, which are the ones usually skipped:
   force a 422 and confirm **no** event fires; double-click the button and
   confirm one event rather than two; reload and scroll past the product twice
   and confirm `view_item` fires once.
6. **Events Manager → Diagnostics** a day later, for type and currency warnings
   that only surface at volume.

### Preventing duplicates if Meta tracking already exists

Shopify stores almost always already fire `AddToCart` from the native Meta sales
channel, a theme app extension, or a hardcoded pixel in `theme.liquid`. A second
sender double-counts, which halves reported cost-per-ATC and corrupts the
optimisation signal.

**Audit first.** Pixel Helper lists every pixel on the page and the events each
one sends. Establish what already fires before adding anything.

**Then pick one of three:**

1. **One sender.** If the incumbent already sends `AddToCart` with a correct
   catalog ID, don't send a second. Use the dataLayer event for GA4 only.
2. **Disable the incumbent.** If the existing event is wrong, missing `value` or
   using the wrong ID format, turn it off at source and let this implementation
   own the event. Never leave both on intending to filter later.
3. **Deduplicate on `event_id`.** The normal case once the Conversions API is in
   play. Meta drops the duplicate when `event_name` and `event_id` match, so the
   same ID must ride on both senders. `analytics.js` generates one `event_id` per
   successful add and puts it in the dataLayer payload: the pixel sends it as
   `eventID`, the CAPI call sends the identical value as `event_id`. Generating
   it separately on each side is the common mistake and defeats the mechanism.

**One more guard.** Bind the tag to the `add_to_cart` Custom Event, never to a
generic click trigger on the button. A click trigger fires on *attempts*, so it
double-counts retries and records conversions for adds that failed.

---

## Browsers and screen sizes tested

**Verified** — Chrome on macOS, driven over the DevTools Protocol, at 21 widths
from 280px (Galaxy Fold) to 2560px (QHD): 280, 320, 360, 375, 390, 412, 430,
480, 540, 640, 720, 768, 820, 900, 1024, 1180, 1280, 1440, 1600, 1920, 2560.

No horizontal overflow at any width. Zero console messages, exceptions or failed
requests, checked against the deployed URLs rather than only localhost.

Interaction paths verified in-browser: gallery thumbnails, arrows and the rail
rebuilding on style change; the Color listbox by keyboard; accordion single-open;
variant and pack switching with price and saving recomputing; the full
add-to-cart round trip; and the double-click guard.

A wider audit across 29 widths also checked for text under 12px, tap targets
under 40px and content clipped inside its own container. It found two real bugs,
both fixed: the buybox overflowed its column by 19px between roughly 860 and
1000px, and the gallery arrows were 38px on touch.

**Not verified** — Safari and Firefox were not available in this environment, so
they are untested rather than known-good. The layout uses `:has()`,
`aspect-ratio`, `clamp()` and `text-wrap: balance`. All four are supported in
current Safari and Firefox, but `:has()` carries the selected state on the
variant chips, so a failure there would be visible rather than cosmetic. That is
the first thing I would check on a real device.

---

## Time spent

About 3.5 hours end to end, across three sessions: roughly 70 minutes for the
first build including design extraction and browser verification, around 90
minutes re-checking every section against the Figma and adding what was missing,
and a final pass for the device audit, cleanup and this document.

---

## Unfinished / known gaps

- **Safari and Firefox are untested.** The gap I would close first.
- **Three of the nine Figma sections were not built** — the "Sounds Familiar"
  problem section, "The Real Difference", and the floating testimonial card. The
  brief asked for five; there are six here plus the trust bar.
- **The cart is write-only.** No drawer, no line-item list, no running total. The
  brief scoped this to the add-to-cart call, so the request succeeds, fires its
  event and reports inline. Nothing accumulates.
- **No automated accessibility audit.** Semantics were built in deliberately —
  radio groups for options, a real `<table>` for the comparison, generated
  `aria-expanded`/`aria-controls`, roving tabindex, a full ARIA listbox for the
  colour dropdown, `role="status"` on the cart message, a skip link — but axe and
  a screen reader were not run over it.
- **One font is substituted.** The comparison table headers use Studio Feixen
  Sans, a commercial licence. Inter carries the same 15px, 2.25px-tracked
  uppercase treatment.
- **No footer.** The Figma's footer is a flattened image rather than laid-out
  content, so there was nothing to reproduce faithfully. The page ends on the FAQ.
- **`preload` covers Inter and Cormorant only**, not Nunito, which is used below
  the fold.

---

## Running it

```bash
python3 -m http.server 8000     # any static server
# → http://localhost:8000
```

The page also opens fine straight from the filesystem. Scripts are classic
`<script>` tags rather than ES modules specifically so that unzipping the
submission and double-clicking `index.html` works without CORS errors, which
would otherwise fill the console the brief asks to keep clean.

```bash
node test/cart-contract.test.js     # 32 passed, 0 failed
```

That test asserts the `/cart/add.js` request shape, both dataLayer payloads, the
once-per-load `view_item` guard, and that the 404 and 422 failure paths push
nothing. No dependencies.

---

## Sections built

| # | Section | Figma node |
|---|---------|-----------|
| 1 | Hero | `1:8` |
| 2 | Product — gallery, style tabs, 3 packs, 2 colours, price, ATC | `1:159` |
| 3 | Reviews — rating summary and three cards | `1:59` |
| 4 | How It Works — four steps | `1:94` |
| 5 | Comparison table | `1:81` |
| 6 | FAQ accordion | `1:255` |

The trust bar under the hero is included too. At 69px it is too small to count
as one of the five, but the hero reads wrong without it.

---

## File layout

```
index.html
css/
  tokens.css        design tokens read off the Figma nodes
  base.css          reset, fonts, shared primitives
  sections.css      per-section layout
  responsive.css    mobile adaptation
js/
  config.js         USE_MOCK_CART, currency, page-variation resolver
  product-data.js   the product, 12 variants, plus the Liquid that replaces it
  analytics.js      dataLayer, view_item, add_to_cart
  cart-api.js       Shopify AJAX Cart API request logic
  cart-mock.js      fetch-shaped mock transport, demo only
  gallery.js        product image gallery
  colorselect.js    the Color dropdown, an ARIA listbox
  accordion.js      FAQ accordion
  main.js           bootstrap and wiring
  debug-panel.js    QA overlay, inert unless ?debug=1
assets/
  fonts/            Cormorant, Inter, Nunito — self-hosted, 119KB
  images/           exported from Figma
test/
  cart-contract.test.js
```

---

## Simulated add to cart

The request logic and the mock live in separate files and neither imports the
other.

**`js/cart-api.js`** is what would ship to a live storefront, unchanged:

```js
send('/cart/add.js', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  body: JSON.stringify({ items: [{ id: variantId, quantity: quantity }] })
})
```

It takes a `transport` argument with the same signature as `window.fetch` and
falls back to `window.fetch` when none is passed. It has no knowledge that a mock
exists. Non-2xx responses are parsed before `ok` is checked, because Shopify puts
the shopper-facing message in the failure body, and are rethrown as a `CartError`
carrying `status`, `message` and `description`.

**`js/cart-mock.js`** implements the same contract: a promise of an object with
`.ok`, `.status` and `.json()`. It simulates latency and returns realistic
payloads — a Shopify line item on success with prices as integer minor units, a
422 when quantity exceeds inventory, a 404 for an unknown variant.

**Going live** is one line in `js/config.js`:

```js
USE_MOCK_CART: false
```

…plus replacing `js/product-data.js` with the Liquid block quoted at the top of
that file.

### Seeing it work

The request never reaches the network, so **the Network tab shows nothing** by
design. Append `?debug=1` to the URL and a panel records the exact POST, the
response status and payload, and every dataLayer push as it happens. It only
observes, and is inert without the query parameter.

To force the failure path, in the console:

```js
Digicom.config.mock.failForVariantId = 45329087452195;
```

The error renders inline, no `add_to_cart` is pushed, and the console stays clean.

---

## dataLayer events

`window.dataLayer` is initialised in `js/analytics.js` before anything can push
to it. Both events use GA4 ecommerce shape, and each push is preceded by
`dataLayer.push({ ecommerce: null })` so fields from the previous event cannot
leak into the next.

Every payload carries `page_variation`, the displayed page variation, resolved
from `?variation=` and defaulting to `control`.

**`view_item`** fires once per page load, when the product section first becomes
visible. An IntersectionObserver watches the section and disconnects the moment
it fires; a module-level flag guards the event a second time.

**`add_to_cart`** fires only inside the `.then()` of the settled promise, never
on button click and never optimistically. A failed add takes the `.catch()`
branch, renders an inline error, and pushes nothing. `value` is the line total,
`items[].price` is the unit price.

```js
{
  event: 'add_to_cart',
  page_variation: 'control',
  event_id: '9f1c2f7e-...',
  ecommerce: {
    currency: 'USD',
    value: 161.84,
    items: [{
      item_id: '45329087452195',
      item_name: 'VoChill Wine Chiller',
      item_brand: 'VoChill',
      item_variant: 'Stemless / Couple Pair / Quartz',
      price: 80.92,
      quantity: 2,
      currency: 'USD'
    }]
  }
}
```

---

## Notes on fidelity

Typography and colour were read from the Figma nodes rather than estimated.
Cormorant for display, Inter for UI and body, Nunito for the ADD TO CART label,
the step badges, the dark section body copy and the FAQ heading. All three are
self-hosted as variable fonts, 119KB total, so the page makes no third-party
requests and renders identically offline.

Three places where the design is ambiguous or contradictory, and what I did:

- The product block shows **$80.92 / $89.95 / Save $8.98**, but 89.95 − 80.92 is
  **$9.03**. The saving is computed from the two prices at runtime so the three
  numbers always agree.
- The style tab reads *Stemless* while the title reads *Stemmed Wine Chiller
  Pair*. I defaulted to Stemless / Couple Pair, the combination priced at the
  $80.92 the design displays.
- The comparison headers use Studio Feixen Sans, a commercial licence. Inter
  carries the same treatment.

One deliberate addition beyond the design: the Figma specifies a single colour,
which leaves the Color dropdown a control with nothing to choose. I added a
Midnight finish, with the swatch derived from the Quartz render, and the six
variants it implies. Removing it is two lines in `product-data.js`.

The Figma gallery is a single static image, so the working gallery is built from
the design's own renders: the main shot, the two style shots, the cradles shot
and the hero lifestyle photo. The rail rebuilds when the shopper switches style.
