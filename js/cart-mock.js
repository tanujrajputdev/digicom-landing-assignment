/*
 * cart-mock.js — demo-only transport.
 *
 * Stands in for the network so the page works without a Shopify backend.
 * It implements the fetch contract (returns a Promise of a Response-like
 * object with .ok, .status and .json()), which is why js/cart-api.js needs no
 * branching: swap this transport out and the request logic is already live.
 *
 * Deleting this file and setting config.USE_MOCK_CART = false is the entire
 * migration to a real storefront.
 */
(function (ns) {
  'use strict';

  var lineItemKeySeed = 0;

  function makeResponse(status, payload) {
    return {
      ok: status >= 200 && status < 300,
      status: status,
      json: function () { return Promise.resolve(payload); }
    };
  }

  /* Mirrors the shape Shopify returns for a line item in /cart/add.js. */
  function buildLineItem(variant, quantity) {
    lineItemKeySeed += 1;
    return {
      id: variant.id,
      key: variant.id + ':' + lineItemKeySeed,
      product_id: variant.productId,
      variant_id: variant.id,
      title: variant.productTitle + ' - ' + variant.title,
      product_title: variant.productTitle,
      variant_title: variant.title,
      quantity: quantity,
      /* Shopify money fields are integers in the shop's minor currency unit. */
      price: Math.round(variant.price * 100),
      line_price: Math.round(variant.price * 100) * quantity,
      final_line_price: Math.round(variant.price * 100) * quantity,
      sku: variant.sku,
      image: variant.image,
      url: '/products/' + variant.handle + '?variant=' + variant.id
    };
  }

  /**
   * Create a fetch-compatible transport bound to a catalogue of variants.
   *
   * @param {Function} lookupVariant  (variantId) => variant object | null
   * @returns {Function} transport(url, init) => Promise<ResponseLike>
   */
  function createTransport(lookupVariant) {
    var settings = ns.config.mock;

    return function transport(url, init) {
      return new Promise(function (resolve) {
        setTimeout(function () {
          var requested;

          try {
            requested = JSON.parse(init.body).items[0];
          } catch (err) {
            return resolve(makeResponse(400, {
              status: 400,
              message: 'Bad Request',
              description: 'Request body could not be parsed.'
            }));
          }

          var variant = lookupVariant(requested.id);

          if (!variant) {
            return resolve(makeResponse(404, {
              status: 404,
              message: 'Cart Error',
              description: 'The variant you requested does not exist.'
            }));
          }

          /* Deliberate failure hook, for demoing the error path. */
          if (settings.failForVariantId && settings.failForVariantId === variant.id) {
            return resolve(makeResponse(422, {
              status: 422,
              message: 'Cart Error',
              description: 'All ' + variant.inventory + ' of ' + variant.title +
                ' are in your cart.'
            }));
          }

          if (requested.quantity > variant.inventory) {
            return resolve(makeResponse(422, {
              status: 422,
              message: 'Cart Error',
              description: 'You can only add ' + variant.inventory + ' of ' +
                variant.title + ' to the cart.'
            }));
          }

          resolve(makeResponse(200, {
            items: [buildLineItem(variant, requested.quantity)]
          }));
        }, settings.latencyMs);
      });
    };
  }

  ns.cartMock = { createTransport: createTransport };
})(window.Digicom = window.Digicom || {});
