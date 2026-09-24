/*
 * gallery.js — product image gallery. No dependencies.
 *
 * Markup contract:
 *   [data-gallery]
 *     [data-gallery-stage] > img[data-gallery-image]
 *     button[data-gallery-prev] / button[data-gallery-next]
 *     [data-gallery-thumbs]            <- filled by setSlides()
 *
 * Slides are supplied by the host page via setSlides(), because the rail has
 * to be rebuilt whenever the shopper switches product style. Thumb buttons are
 * generated here so the markup contract stays minimal.
 *
 * Behaviour: click thumbs, arrow keys with a roving tabindex, Home/End,
 * horizontal swipe on the stage, and preloading so switching never flashes.
 */
(function (ns) {
  'use strict';

  var SWIPE_THRESHOLD_PX = 40;

  function Gallery(root) {
    this.root = root;
    this.stage = root.querySelector('[data-gallery-stage]');
    this.image = root.querySelector('[data-gallery-image]');
    this.thumbList = root.querySelector('[data-gallery-thumbs]');
    this.prevBtn = root.querySelector('[data-gallery-prev]');
    this.nextBtn = root.querySelector('[data-gallery-next]');
    this.thumbs = [];
    this.index = 0;
    this.touchStartX = null;

    this.bindControls();
  }

  /**
   * Replace every slide and reset to the first one.
   * @param {Array<{src: string, alt: string}>} slides
   */
  Gallery.prototype.setSlides = function (slides) {
    if (!this.thumbList || !slides || !slides.length) return;

    var total = slides.length;
    this.thumbList.textContent = '';

    slides.forEach(function (slide, i) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'gallery__thumb';
      button.setAttribute('data-gallery-thumb', '');
      button.setAttribute('data-src', slide.src);
      button.setAttribute('data-alt', slide.alt);
      button.setAttribute('aria-label', 'Show image ' + (i + 1) + ' of ' + total);

      var img = document.createElement('img');
      img.src = slide.src;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';

      button.appendChild(img);
      this.thumbList.appendChild(button);
    }, this);

    this.thumbs = Array.prototype.slice
      .call(this.thumbList.querySelectorAll('[data-gallery-thumb]'));

    this.bindThumbs();
    this.preload();
    this.select(0, { focusThumb: false });
  };

  /* Warm the cache so a thumb click swaps instantly. */
  Gallery.prototype.preload = function () {
    this.thumbs.forEach(function (thumb) {
      var img = new Image();
      img.src = thumb.getAttribute('data-src');
    });
  };

  Gallery.prototype.bindControls = function () {
    var self = this;

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', function () { self.step(-1); });
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', function () { self.step(1); });
    }

    if (this.stage) {
      this.stage.addEventListener('touchstart', function (event) {
        self.touchStartX = event.changedTouches[0].clientX;
      }, { passive: true });

      this.stage.addEventListener('touchend', function (event) {
        if (self.touchStartX === null) return;
        var delta = event.changedTouches[0].clientX - self.touchStartX;
        self.touchStartX = null;
        if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
        self.step(delta < 0 ? 1 : -1);
      }, { passive: true });
    }
  };

  Gallery.prototype.bindThumbs = function () {
    var self = this;

    this.thumbs.forEach(function (thumb, i) {
      thumb.addEventListener('click', function () {
        self.select(i, { focusThumb: false });
      });
      thumb.addEventListener('keydown', function (event) {
        self.onThumbKeydown(event);
      });
    });
  };

  Gallery.prototype.onThumbKeydown = function (event) {
    var handled = true;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        this.step(1, { focusThumb: true });
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        this.step(-1, { focusThumb: true });
        break;
      case 'Home':
        this.select(0, { focusThumb: true });
        break;
      case 'End':
        this.select(this.thumbs.length - 1, { focusThumb: true });
        break;
      default:
        handled = false;
    }

    if (handled) event.preventDefault();
  };

  Gallery.prototype.step = function (delta, options) {
    if (!this.thumbs.length) return;
    var next = (this.index + delta + this.thumbs.length) % this.thumbs.length;
    this.select(next, options);
  };

  Gallery.prototype.select = function (index, options) {
    var settings = options || {};
    var thumb = this.thumbs[index];
    if (!thumb || !this.image) return;

    this.index = index;

    this.image.src = thumb.getAttribute('data-src');
    this.image.alt = thumb.getAttribute('data-alt') || '';

    this.thumbs.forEach(function (item, i) {
      var isActive = i === index;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-current', isActive ? 'true' : 'false');
      /* Roving tabindex: the rail is a single tab stop. */
      item.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    if (settings.focusThumb) thumb.focus();
  };

  function init(scope) {
    var roots = (scope || document).querySelectorAll('[data-gallery]');
    return Array.prototype.map.call(roots, function (root) {
      return new Gallery(root);
    });
  }

  ns.gallery = { init: init, Gallery: Gallery };
})(window.Digicom = window.Digicom || {});
