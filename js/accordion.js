/*
 * accordion.js — FAQ accordion. No dependencies.
 *
 * Expected markup contract:
 *   [data-accordion]            add data-accordion="single" to allow one open item
 *     [data-accordion-item]     add data-accordion-open to start expanded
 *       button[data-accordion-trigger]
 *       [data-accordion-panel]
 *
 * Accessibility: aria-expanded / aria-controls are wired up at runtime so the
 * markup stays clean, ids are generated if missing, and Up/Down/Home/End move
 * between triggers. Honours prefers-reduced-motion.
 */
(function (ns) {
  'use strict';

  var uid = 0;

  function prefersReducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function Accordion(root) {
    var self = this;

    this.root = root;
    this.singleOpen = root.getAttribute('data-accordion') === 'single';
    this.items = Array.prototype.slice
      .call(root.querySelectorAll('[data-accordion-item]'))
      .map(function (element) { return self.prepare(element); })
      .filter(Boolean);

    this.bind();
  }

  Accordion.prototype.prepare = function (element) {
    var trigger = element.querySelector('[data-accordion-trigger]');
    var panel = element.querySelector('[data-accordion-panel]');
    if (!trigger || !panel) return null;

    uid += 1;
    var triggerId = trigger.id || 'accordion-trigger-' + uid;
    var panelId = panel.id || 'accordion-panel-' + uid;

    trigger.id = triggerId;
    panel.id = panelId;
    trigger.setAttribute('aria-controls', panelId);
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', triggerId);

    var item = { element: element, trigger: trigger, panel: panel, isOpen: false };

    if (element.hasAttribute('data-accordion-open')) {
      this.open(item, { animate: false });
    } else {
      this.close(item, { animate: false });
    }

    return item;
  };

  Accordion.prototype.bind = function () {
    var self = this;

    this.items.forEach(function (item, index) {
      item.trigger.addEventListener('click', function () {
        self.toggle(item);
      });

      item.trigger.addEventListener('keydown', function (event) {
        self.onKeydown(event, index);
      });

      /*
       * When a CSS transition finishes on an open panel, drop the fixed
       * max-height so the panel can grow if its content reflows (font load,
       * viewport resize) without being clipped.
       */
      item.panel.addEventListener('transitionend', function (event) {
        if (event.propertyName !== 'max-height') return;
        if (item.isOpen) item.panel.style.maxHeight = 'none';
      });
    });
  };

  Accordion.prototype.onKeydown = function (event, index) {
    var last = this.items.length - 1;
    var target = null;

    switch (event.key) {
      case 'ArrowDown': target = index === last ? 0 : index + 1; break;
      case 'ArrowUp':   target = index === 0 ? last : index - 1; break;
      case 'Home':      target = 0; break;
      case 'End':       target = last; break;
      default: return;
    }

    event.preventDefault();
    this.items[target].trigger.focus();
  };

  Accordion.prototype.toggle = function (item) {
    if (item.isOpen) {
      this.close(item);
      return;
    }

    if (this.singleOpen) {
      var self = this;
      this.items.forEach(function (other) {
        if (other !== item && other.isOpen) self.close(other);
      });
    }

    this.open(item);
  };

  Accordion.prototype.open = function (item, options) {
    var animate = !(options && options.animate === false) && !prefersReducedMotion();

    item.isOpen = true;
    item.element.classList.add('is-open');
    item.trigger.setAttribute('aria-expanded', 'true');
    item.panel.hidden = false;

    if (!animate) {
      item.panel.style.maxHeight = 'none';
      return;
    }

    item.panel.style.maxHeight = item.panel.scrollHeight + 'px';
  };

  Accordion.prototype.close = function (item, options) {
    var animate = !(options && options.animate === false) && !prefersReducedMotion();

    item.isOpen = false;
    item.element.classList.remove('is-open');
    item.trigger.setAttribute('aria-expanded', 'false');

    if (!animate) {
      item.panel.style.maxHeight = '0px';
      return;
    }

    /*
     * max-height cannot transition from `none`, so pin it to the measured
     * height first, force a reflow, then collapse on the next frame.
     */
    item.panel.style.maxHeight = item.panel.scrollHeight + 'px';
    void item.panel.offsetHeight;

    requestAnimationFrame(function () {
      item.panel.style.maxHeight = '0px';
    });
  };

  function init(scope) {
    var roots = (scope || document).querySelectorAll('[data-accordion]');
    return Array.prototype.map.call(roots, function (root) {
      return new Accordion(root);
    });
  }

  ns.accordion = { init: init, Accordion: Accordion };
})(window.Digicom = window.Digicom || {});
