/*
 * product-data.js — the product the page sells.
 *
 * On a real storefront this object would not exist as a file: the theme would
 * render it into the page from Liquid, e.g.
 *
 *   <script>
 *     window.Digicom = window.Digicom || {};
 *     window.Digicom.product = {
 *       id:     {{ product.id | json }},
 *       name:   {{ product.title | json }},
 *       brand:  {{ product.vendor | json }},
 *       handle: {{ product.handle | json }},
 *       variants: [
 *         {%- for variant in product.variants -%}
 *         {
 *           id:           {{ variant.id }},
 *           title:        {{ variant.title | json }},
 *           sku:          {{ variant.sku | json }},
 *           price:        {{ variant.price | divided_by: 100.0 }},
 *           compareAt:    {{ variant.compare_at_price | divided_by: 100.0 }},
 *           inventory:    {{ variant.inventory_quantity }},
 *           style:        {{ variant.option1 | handleize | json }},
 *           pack:         {{ variant.option2 | handleize | json }},
 *           color:        {{ variant.option3 | handleize | json }}
 *         }{%- unless forloop.last -%},{%- endunless -%}
 *         {%- endfor -%}
 *       ],
 *       selectedVariantId: {{ product.selected_or_first_available_variant.id }}
 *     };
 *   </script>
 *
 * Variant ids below use Shopify's real id shape, so the request body the mock
 * receives is indistinguishable from a live one.
 */
(function (ns) {
  'use strict';

  /* Option 1 — product style. Drives the tab strip and the gallery. */
  var STYLES = [
    {
      id: 'stemless',
      label: 'Stemless Wine Chiller Pair',
      heading: 'Stemless Wine Chiller',
      thumb: 'assets/images/gallery-stemless.webp',
      blurb: 'Works with any standard stemless wine glasses'
    },
    {
      id: 'stemmed',
      label: 'Stemmed Wine Chiller Pair',
      heading: 'Stemmed Wine Chiller',
      thumb: 'assets/images/gallery-stemmed.webp',
      blurb: 'Works with any standard stemmed wine glasses'
    }
  ];

  /*
   * Option 2 — pack size. `badge` renders the merchandising strip along the
   * bottom edge of the chip ("Most Popular" / "Best Value" in the design).
   */
  var PACKS = [
    { id: 'single',    label: 'Single',                       headingWord: 'Single',        badge: null },
    { id: 'pair',      label: 'Couple Pair',                  headingWord: 'Pair',          badge: 'Most Popular' },
    { id: 'pair-plus', label: 'Couple Pair + 2 Chill Cradles', headingWord: 'Pair + Cradles', badge: 'Best Value' }
  ];

  ns.product = {
    id: 8472910385621,
    name: 'VoChill Wine Chiller',
    brand: 'VoChill',
    handle: 'vochill-wine-chiller',
    styles: STYLES,
    packs: PACKS,
    colors: [
      { id: 'quartz',   label: 'Quartz',   swatch: 'assets/images/swatch-quartz.webp' },
      { id: 'midnight', label: 'Midnight', swatch: 'assets/images/swatch-midnight.webp' }
    ],
    selectedVariantId: 45329087452195,

    variants: [
      /* --------------------------------------------------------- stemless */
      { id: 45329087452194, style: 'stemless', pack: 'single',    color: 'quartz',
        title: 'Stemless / Single / Quartz',
        sku: 'VC-STMLS-SGL-QTZ', price: 40.46, compareAt: 44.95, inventory: 24 },

      { id: 45329087452195, style: 'stemless', pack: 'pair',      color: 'quartz',
        title: 'Stemless / Couple Pair / Quartz',
        sku: 'VC-STMLS-PR-QTZ',  price: 80.92, compareAt: 89.95, inventory: 18 },

      { id: 45329087452196, style: 'stemless', pack: 'pair-plus', color: 'quartz',
        title: 'Stemless / Couple Pair + 2 Chill Cradles / Quartz',
        sku: 'VC-STMLS-PRC-QTZ', price: 107.92, compareAt: 119.95, inventory: 9 },

      /* ---------------------------------------------------------- stemmed */
      { id: 45329087452197, style: 'stemmed',  pack: 'single',    color: 'quartz',
        title: 'Stemmed / Single / Quartz',
        sku: 'VC-STMD-SGL-QTZ',  price: 40.46, compareAt: 44.95, inventory: 31 },

      { id: 45329087452198, style: 'stemmed',  pack: 'pair',      color: 'quartz',
        title: 'Stemmed / Couple Pair / Quartz',
        sku: 'VC-STMD-PR-QTZ',   price: 80.92, compareAt: 89.95, inventory: 12 },

      { id: 45329087452199, style: 'stemmed',  pack: 'pair-plus', color: 'quartz',
        title: 'Stemmed / Couple Pair + 2 Chill Cradles / Quartz',
        sku: 'VC-STMD-PRC-QTZ',  price: 107.92, compareAt: 119.95, inventory: 4 },

      /* ------------------------------------------- midnight (+$4 finish) */
      { id: 45329087452200, style: 'stemless', pack: 'single',    color: 'midnight',
        title: 'Stemless / Single / Midnight',
        sku: 'VC-STMLS-SGL-MID', price: 44.46, compareAt: 48.95, inventory: 16 },

      { id: 45329087452201, style: 'stemless', pack: 'pair',      color: 'midnight',
        title: 'Stemless / Couple Pair / Midnight',
        sku: 'VC-STMLS-PR-MID',  price: 84.92, compareAt: 94.95, inventory: 11 },

      { id: 45329087452202, style: 'stemless', pack: 'pair-plus', color: 'midnight',
        title: 'Stemless / Couple Pair + 2 Chill Cradles / Midnight',
        sku: 'VC-STMLS-PRC-MID', price: 111.92, compareAt: 124.95, inventory: 7 },

      { id: 45329087452203, style: 'stemmed',  pack: 'single',    color: 'midnight',
        title: 'Stemmed / Single / Midnight',
        sku: 'VC-STMD-SGL-MID',  price: 44.46, compareAt: 48.95, inventory: 22 },

      { id: 45329087452204, style: 'stemmed',  pack: 'pair',      color: 'midnight',
        title: 'Stemmed / Couple Pair / Midnight',
        sku: 'VC-STMD-PR-MID',   price: 84.92, compareAt: 94.95, inventory: 9 },

      { id: 45329087452205, style: 'stemmed',  pack: 'pair-plus', color: 'midnight',
        title: 'Stemmed / Couple Pair + 2 Chill Cradles / Midnight',
        sku: 'VC-STMD-PRC-MID',  price: 111.92, compareAt: 124.95, inventory: 3 }
    ],

    /* Gallery slides. Keyed by style so switching tabs reorders the gallery. */
    gallery: {
      stemless: [
        { src: 'assets/images/gallery-main.webp',      alt: 'A pair of stemless VoChill wine chillers holding filled glasses' },
        { src: 'assets/images/gallery-stemless.webp',  alt: 'Stemless VoChill chiller shown on its own' },
        { src: 'assets/images/gallery-cradles.webp',   alt: 'Couple pair with two spare Chill Cradles' },
        { src: 'assets/images/gallery-lifestyle.webp', alt: 'Two friends raising chilled glasses of rosé poolside' }
      ],
      stemmed: [
        { src: 'assets/images/gallery-stemmed.webp',   alt: 'Stemmed VoChill chiller cradling a wine glass' },
        { src: 'assets/images/gallery-main.webp',      alt: 'A pair of VoChill wine chillers holding filled glasses' },
        { src: 'assets/images/gallery-cradles.webp',   alt: 'Couple pair with two spare Chill Cradles' },
        { src: 'assets/images/gallery-lifestyle.webp', alt: 'Two friends raising chilled glasses of rosé poolside' }
      ]
    }
  };
})(window.Digicom = window.Digicom || {});
