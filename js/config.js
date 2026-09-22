/*
 * config.js — single place for the switches a reviewer will want to flip.
 * Loaded first; everything else reads from window.Digicom.config.
 */
(function (ns) {
  'use strict';

  /**
   * Resolve the A/B page variation currently being displayed.
   * On a real store this would be written by the experiment framework
   * (Optimizely / GrowthBook / a Shopify theme setting). Here it is
   * readable from the query string so it can be demoed: ?variation=b
   */
  function resolvePageVariation() {
    try {
      var fromQuery = new URLSearchParams(window.location.search).get('variation');
      if (fromQuery) return fromQuery.toLowerCase();
    } catch (err) {
      /* URLSearchParams is unavailable — fall through to the default. */
    }
    return 'control';
  }

  ns.config = {
    /*
     * The only line separating this demo from a live storefront.
     * true  -> requests are served by js/cart-mock.js
     * false -> requests go to the real Shopify /cart/add.js on the same origin
     */
    USE_MOCK_CART: true,

    currency: 'USD',
    pageVariation: resolvePageVariation(),

    /* Latency + failure behaviour of the mock transport. */
    mock: {
      latencyMs: 650,
      /* Set to a variant id to make that variant fail, for testing the error path. */
      failForVariantId: null
    }
  };
})(window.Digicom = window.Digicom || {});
