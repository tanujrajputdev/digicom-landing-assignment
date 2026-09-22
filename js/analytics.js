/*
 * analytics.js — window.dataLayer plumbing.
 *
 * Two events are implemented, both in GA4 ecommerce shape:
 *   view_item    once per page load, when the product section first becomes visible
 *   add_to_cart  only after the simulated cart request resolves successfully
 *
 * Every payload carries the displayed page variation so the events can be
 * split by experiment arm downstream.
 */
(function (ns) {
  'use strict';

  /* Initialise before anything can push to it. */
  window.dataLayer = window.dataLayer || [];

  var viewItemHasFired = false;

  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  /*
   * Deduplication key shared by the Meta Pixel (browser) and the Conversions
   * API (server) for the same conversion. Meta drops the duplicate when
   * event_name + event_id match within its dedup window, so this value must be
   * generated once per conversion and reused by both senders.
   */
  function makeEventId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'evt-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 10);
  }

  /*
   * GA4 requires the previous ecommerce object to be cleared, otherwise
   * fields from the last event leak into the next one.
   */
  function pushEcommerce(eventName, ecommerce, extras) {
    window.dataLayer.push({ ecommerce: null });

    var payload = {
      event: eventName,
      page_variation: ns.config.pageVariation,
      ecommerce: ecommerce
    };

    if (extras) {
      Object.keys(extras).forEach(function (key) {
        payload[key] = extras[key];
      });
    }

    window.dataLayer.push(payload);
    return payload;
  }

  /**
   * Build the GA4 `items` array entry for the product.
   * @param {Object} product  { id, name, price, ... }
   * @param {number} quantity
   */
  function toItem(product, quantity) {
    return {
      item_id: String(product.id),
      item_name: product.name,
      item_brand: product.brand,
      item_variant: product.variantName,
      price: round2(product.price),
      quantity: quantity,
      currency: ns.config.currency
    };
  }

  /**
   * Fires at most once per page load. Later calls are no-ops, which keeps the
   * event safe to wire to an IntersectionObserver that may re-trigger.
   */
  function viewItem(product) {
    if (viewItemHasFired) return null;
    viewItemHasFired = true;

    return pushEcommerce('view_item', {
      currency: ns.config.currency,
      value: round2(product.price),
      items: [toItem(product, 1)]
    });
  }

  /**
   * Called only from the success branch of the cart request.
   * `value` is the line total (unit price x quantity), not the unit price.
   */
  function addToCart(product, quantity) {
    return pushEcommerce('add_to_cart', {
      currency: ns.config.currency,
      value: round2(product.price * quantity),
      items: [toItem(product, quantity)]
    }, {
      event_id: makeEventId()
    });
  }

  ns.analytics = {
    viewItem: viewItem,
    addToCart: addToCart,
    hasViewItemFired: function () { return viewItemHasFired; }
  };
})(window.Digicom = window.Digicom || {});
