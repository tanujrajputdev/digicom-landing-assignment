/*
 * cart-api.js — Shopify AJAX Cart API request logic.
 *
 * This file contains NO mock data and no knowledge that a mock exists. It is
 * the code that would ship to a live storefront unchanged. The network call is
 * performed through an injected `transport` (same signature as window.fetch),
 * which is the only seam the demo uses to swap in js/cart-mock.js.
 *
 * Reference: POST /cart/add.js
 *   body:    { items: [ { id: <variant id>, quantity: <n> } ] }
 *   200:     { items: [ <line item>, ... ] }
 *   422:     { status, message, description }
 */
(function (ns) {
  'use strict';

  var CART_ADD_ENDPOINT = '/cart/add.js';

  function CartError(message, status, body) {
    this.name = 'CartError';
    this.message = message;
    this.status = status;
    this.body = body || null;
  }
  CartError.prototype = Object.create(Error.prototype);
  CartError.prototype.constructor = CartError;

  /**
   * Add a variant to the cart.
   *
   * @param {Object}   options
   * @param {number}   options.variantId  Shopify variant id (not the product id).
   * @param {number}   options.quantity
   * @param {Object}   [options.properties]  Optional line item properties.
   * @param {Function} [transport]  fetch-compatible function. Defaults to window.fetch.
   * @returns {Promise<Object>} resolves with the parsed /cart/add.js response.
   */
  function addToCart(options, transport) {
    var send = transport || function (url, init) { return window.fetch(url, init); };

    var body = {
      items: [{
        id: options.variantId,
        quantity: options.quantity
      }]
    };

    if (options.properties) {
      body.items[0].properties = options.properties;
    }

    return send(CART_ADD_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    }).then(function (response) {
      /*
       * Shopify answers with JSON on both success and failure, so parse first
       * and decide afterwards. A non-JSON body means something upstream broke
       * (proxy, redirect to a password page) and is surfaced as a CartError
       * rather than an unhandled parse rejection.
       */
      return response.json().catch(function () {
        throw new CartError('Cart response was not valid JSON.', response.status, null);
      }).then(function (data) {
        if (!response.ok) {
          throw new CartError(
            data.description || data.message || 'Unable to add this item to the cart.',
            response.status,
            data
          );
        }
        return data;
      });
    });
  }

  ns.cartApi = {
    addToCart: addToCart,
    CartError: CartError,
    CART_ADD_ENDPOINT: CART_ADD_ENDPOINT
  };
})(window.Digicom = window.Digicom || {});
