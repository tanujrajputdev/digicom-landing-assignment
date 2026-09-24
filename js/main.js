/*
 * main.js — bootstrap. Renders the variant controls, wires the gallery and
 * accordion, performs the cart request and fires the dataLayer events.
 * Loaded last.
 */
(function (ns) {
  'use strict';

  var VIEW_ITEM_VISIBILITY_RATIO = 0.25;
  var VIEW_ITEM_VIEWPORT_FILL = 0.5;

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        node.setAttribute(key, attrs[key]);
      });
    }
    return node;
  }

  function formatMoney(amount) {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: ns.config.currency
      }).format(amount);
    } catch (err) {
      return '$' + amount.toFixed(2);
    }
  }

  function findById(list, id) {
    var found = null;
    list.forEach(function (item) { if (item.id === id) found = item; });
    return found;
  }

  function ProductSection(root) {
    var product = ns.product;

    this.root = root;
    this.product = product;
    this.form = root.querySelector('[data-product-form]');
    this.styleList = root.querySelector('[data-style-list]');
    this.packList = root.querySelector('[data-pack-list]');
    this.colorList = root.querySelector('[data-color-list]');
    this.heading = root.querySelector('[data-product-heading]');
    this.priceNow = root.querySelector('[data-price-now]');
    this.priceWas = root.querySelector('[data-price-was]');
    this.priceSave = root.querySelector('[data-price-save]');
    this.glassware = root.querySelector('[data-feature-glassware]');
    this.stockNote = root.querySelector('[data-stock-note]');
    this.colorRoot = root.querySelector('[data-color-select]');
    this.addButton = root.querySelector('[data-add-to-cart]');
    this.statusEl = root.querySelector('[data-cart-status]');
    this.isSubmitting = false;

    var selected = findById(product.variants, product.selectedVariantId) || product.variants[0];
    this.selection = {
      style: selected.style,
      pack: selected.pack,
      color: selected.color
    };

    /*
     * The transport is chosen once, here. js/cart-api.js is identical either
     * way — that is the point of keeping the mock out of it.
     */
    this.transport = ns.config.USE_MOCK_CART
      ? ns.cartMock.createTransport(this.lookupVariantForMock.bind(this))
      : null; /* null -> cart-api falls back to window.fetch */

    this.galleries = ns.gallery.init(root);
    this.gallery = this.galleries[0] || null;

    this.renderOptions();
    this.bind();
    this.sync();
    this.observeForViewItem();
  }

  /* Shapes a variant the way the mock transport expects to receive it. */
  ProductSection.prototype.lookupVariantForMock = function (variantId) {
    var variant = findById(this.product.variants, variantId);
    if (!variant) return null;

    return {
      id: variant.id,
      productId: this.product.id,
      productTitle: this.product.name,
      title: variant.title,
      sku: variant.sku,
      price: variant.price,
      inventory: variant.inventory,
      handle: this.product.handle,
      image: null
    };
  };

  ProductSection.prototype.currentVariant = function () {
    var sel = this.selection;
    var match = null;

    this.product.variants.forEach(function (variant) {
      if (variant.style === sel.style &&
          variant.pack === sel.pack &&
          variant.color === sel.color) {
        match = variant;
      }
    });

    return match;
  };

  /*
   * The Figma has no quantity stepper — the pack option is the quantity
   * choice. Kept as a seam so the cart request and the dataLayer payload still
   * carry an explicit quantity, and so a stepper is one change away.
   */
  ProductSection.prototype.currentQuantity = function () {
    return 1;
  };

  /*
   * Options render as real radio inputs. Radio groups give keyboard
   * navigation, grouping semantics and form state for free — no JS
   * substitute needed.
   */
  ProductSection.prototype.renderOptions = function () {
    var self = this;

    if (this.styleList) {
      this.product.styles.forEach(function (style) {
        self.styleList.appendChild(self.buildOption({
          group: 'style',
          value: style.id,
          label: style.label,
          image: style.thumb,
          className: 'styleswitch__item',
          checked: style.id === self.selection.style
        }));
      });
    }

    if (this.packList) {
      this.product.packs.forEach(function (pack) {
        var variant = self.variantFor(self.selection.style, pack.id, self.selection.color);
        self.packList.appendChild(self.buildOption({
          group: 'pack',
          value: pack.id,
          label: pack.label,
          image: self.packImage(pack.id),
          className: 'chip',
          badge: pack.badge,
          checked: pack.id === self.selection.pack,
          disabled: !variant || variant.inventory < 1
        }));
      });
    }

    if (this.colorRoot && ns.ColorSelect) {
      this.colorSelect = new ns.ColorSelect(
        this.colorRoot,
        this.product.colors,
        function (colorId) {
          self.selection.color = colorId;
          self.sync();
        }
      );
    }
  };

  ProductSection.prototype.packImage = function (packId) {
    if (packId === 'pair-plus') return 'assets/images/gallery-cradles.webp';
    var style = findById(this.product.styles, this.selection.style);
    return style ? style.thumb : 'assets/images/gallery-main.webp';
  };

  ProductSection.prototype.buildOption = function (spec) {
    var label = el('label', spec.className);
    if (spec.disabled) label.classList.add('is-disabled');

    var input = el('input', null, { type: 'radio', name: spec.group, value: spec.value });
    if (spec.checked) input.checked = true;
    if (spec.disabled) input.disabled = true;

    var img = el('img', null, {
      src: spec.image, alt: '', loading: 'lazy', decoding: 'async'
    });

    var text = el('span');
    text.textContent = spec.label;

    label.appendChild(input);
    label.appendChild(img);
    label.appendChild(text);

    /* Merchandising strip along the bottom edge ("Most Popular"/"Best Value"). */
    if (spec.badge) {
      label.classList.add('has-badge');
      var badge = el('span', 'chip__badge');
      badge.textContent = spec.badge;
      label.appendChild(badge);
    }

    return label;
  };

  ProductSection.prototype.variantFor = function (style, pack, color) {
    var match = null;
    this.product.variants.forEach(function (variant) {
      if (variant.style === style && variant.pack === pack && variant.color === color) {
        match = variant;
      }
    });
    return match;
  };

  ProductSection.prototype.bind = function () {
    var self = this;

    if (this.form) {
      this.form.addEventListener('submit', function (event) {
        event.preventDefault();
        self.submit();
      });
    }

    /*
     * One delegated change handler covers every option group, including the
     * style radios that live outside the form element.
     */
    this.root.addEventListener('change', function (event) {
      var target = event.target;
      if (!target || target.type !== 'radio') return;
      if (!self.selection.hasOwnProperty(target.name)) return;

      self.selection[target.name] = target.value;
      self.sync({ styleChanged: target.name === 'style' });
    });

    /* Hero buttons deep-link into a specific style. */
    Array.prototype.forEach.call(
      document.querySelectorAll('[data-hero-style]'),
      function (link) {
        link.addEventListener('click', function () {
          var wanted = link.getAttribute('data-hero-style');
          var input = self.root.querySelector('input[name="style"][value="' + wanted + '"]');
          if (!input || input.checked) return;
          input.checked = true;
          self.selection.style = wanted;
          self.sync({ styleChanged: true });
        });
      }
    );
  };

  ProductSection.prototype.sync = function (options) {
    var settings = options || {};
    var variant = this.currentVariant();
    var style = findById(this.product.styles, this.selection.style);
    var pack = findById(this.product.packs, this.selection.pack);

    if (this.heading && style && pack) {
      this.heading.textContent = style.heading + ' ' + pack.headingWord;
    }

    if (this.glassware && style) {
      this.glassware.textContent = style.blurb;
    }

    if (variant) {
      if (this.priceNow) this.priceNow.textContent = formatMoney(variant.price);

      if (this.priceWas) {
        var hasCompare = variant.compareAt > variant.price;
        this.priceWas.textContent = hasCompare ? formatMoney(variant.compareAt) : '';
        this.priceWas.hidden = !hasCompare;
      }

      if (this.priceSave) {
        /*
         * Derived rather than hardcoded. The Figma shows "$80.92 / $89.95 /
         * Save $8.98", where the saving is actually $9.03 — computing it keeps
         * the three numbers consistent with each other.
         */
        var saving = variant.compareAt - variant.price;
        var showSaving = saving > 0;
        this.priceSave.textContent = showSaving ? 'Save ' + formatMoney(saving) : '';
        this.priceSave.hidden = !showSaving;
      }

      if (this.stockNote) {
        this.stockNote.textContent = variant.inventory <= 5
          ? 'Only ' + variant.inventory + ' left'
          : '';
      }
    }

    /* Pack availability depends on the selected style. */
    var self = this;
    Array.prototype.forEach.call(
      this.root.querySelectorAll('input[name="pack"]'),
      function (input) {
        var candidate = self.variantFor(self.selection.style, input.value, self.selection.color);
        var unavailable = !candidate || candidate.inventory < 1;
        input.disabled = unavailable;
        if (input.parentNode) input.parentNode.classList.toggle('is-disabled', unavailable);
      }
    );

    if (this.addButton) {
      this.addButton.disabled = !variant || variant.inventory < 1;
    }

    if (settings.styleChanged && this.gallery) {
      this.gallery.setSlides(this.product.gallery[this.selection.style] || []);
    }
  };

  ProductSection.prototype.setStatus = function (message, tone) {
    if (!this.statusEl) return;
    this.statusEl.textContent = message;
    this.statusEl.setAttribute('data-tone', tone || 'neutral');
  };

  ProductSection.prototype.setLoading = function (isLoading) {
    this.isSubmitting = isLoading;
    if (!this.addButton) return;
    this.addButton.disabled = isLoading;
    this.addButton.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    this.addButton.classList.toggle('is-loading', isLoading);
  };

  ProductSection.prototype.submit = function () {
    if (this.isSubmitting) return;

    var self = this;
    var variant = this.currentVariant();
    if (!variant) return;

    var quantity = this.currentQuantity();

    this.setLoading(true);
    this.setStatus('Adding to cart…', 'neutral');

    ns.cartApi.addToCart(
      { variantId: variant.id, quantity: quantity },
      this.transport
    ).then(function (cart) {
      /*
       * add_to_cart fires here and nowhere else — only once the request has
       * actually resolved successfully.
       */
      ns.analytics.addToCart({
        id: variant.id,
        name: self.product.name,
        brand: self.product.brand,
        variantName: variant.title,
        price: variant.price
      }, quantity);

      self.setStatus(
        'Added — ' + quantity + ' × ' + variant.title + ' · ' +
        formatMoney(variant.price * quantity),
        'success'
      );

      return cart;
    }).catch(function (error) {
      /* No dataLayer event on failure. Handled, so nothing reaches the console. */
      self.setStatus(
        (error && error.message) || 'Something went wrong. Please try again.',
        'error'
      );
    }).then(function () {
      self.setLoading(false);
    });
  };

  ProductSection.prototype.observeForViewItem = function () {
    var self = this;

    function fire() {
      var variant = self.currentVariant();
      if (!variant) return;
      ns.analytics.viewItem({
        id: variant.id,
        name: self.product.name,
        brand: self.product.brand,
        variantName: variant.title,
        price: variant.price
      });
    }

    if (!('IntersectionObserver' in window)) {
      fire(); /* Old browser: fire on load rather than not at all. */
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;

        /*
         * A quarter of the section is the intent, but intersectionRatio is a
         * fraction of the *element*, so a section taller than four viewports
         * could never reach 0.25 however far it is scrolled. Treat "fills half
         * the viewport" as visible too, so the event cannot be stranded.
         */
        var viewport = window.innerHeight || document.documentElement.clientHeight || 1;
        var fillsViewport = entry.intersectionRect.height / viewport >= VIEW_ITEM_VIEWPORT_FILL;

        if (entry.intersectionRatio < VIEW_ITEM_VISIBILITY_RATIO && !fillsViewport) return;

        fire();
        observer.disconnect(); /* once per page load */
      });
    }, { threshold: [0, 0.1, 0.25, 0.5] });

    observer.observe(this.root);
  };

  function init() {
    ns.accordion.init();

    var productRoot = document.querySelector('[data-product-section]');
    if (productRoot && ns.product) {
      ns.productSection = new ProductSection(productRoot);
      /* Seed the gallery for the initially selected style. */
      if (ns.productSection.gallery) {
        ns.productSection.gallery.setSlides(
          ns.product.gallery[ns.productSection.selection.style] || []
        );
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window.Digicom = window.Digicom || {});
