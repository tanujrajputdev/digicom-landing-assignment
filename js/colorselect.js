/*
 * colorselect.js — the Color dropdown from the design.
 *
 * A native <select> cannot show the product thumbnail the design calls for, so
 * this is a hand-built listbox following the WAI-ARIA pattern: a button with
 * aria-haspopup + aria-expanded, a ul[role="listbox"] of li[role="option"],
 * full keyboard support, and focus returned to the button on close.
 *
 * Markup contract:
 *   [data-color-select]
 *     button[data-color-button] > img[data-color-thumb] + [data-color-value]
 *     ul[data-color-list]
 */
(function (ns) {
  'use strict';

  function ColorSelect(root, options, onSelect) {
    this.root = root;
    this.button = root.querySelector('[data-color-button]');
    this.list = root.querySelector('[data-color-list]');
    this.thumb = root.querySelector('[data-color-thumb]');
    this.valueEl = root.querySelector('[data-color-value]');
    this.onSelect = onSelect || function () {};
    this.options = options || [];
    this.items = [];
    this.activeIndex = 0;
    this.isOpen = false;

    if (!this.button || !this.list) return;

    this.render();
    this.bind();
  }

  ColorSelect.prototype.render = function () {
    var self = this;
    this.list.textContent = '';

    this.options.forEach(function (option, i) {
      var li = document.createElement('li');
      li.className = 'colorselect__option';
      li.id = 'color-option-' + option.id;
      li.setAttribute('role', 'option');
      li.setAttribute('data-value', option.id);
      li.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      li.setAttribute('tabindex', '-1');

      var img = document.createElement('img');
      img.src = option.swatch;
      img.alt = '';
      img.width = 44;
      img.height = 44;
      img.loading = 'lazy';

      var span = document.createElement('span');
      span.textContent = option.label;

      li.appendChild(img);
      li.appendChild(span);
      self.list.appendChild(li);
    });

    this.items = Array.prototype.slice.call(this.list.children);
    this.select(0, { silent: true });
  };

  ColorSelect.prototype.bind = function () {
    var self = this;

    this.button.addEventListener('click', function () { self.toggle(); });

    this.button.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        self.open();
      }
    });

    this.items.forEach(function (item, i) {
      item.addEventListener('click', function () {
        self.select(i);
        self.close({ focusButton: true });
      });
    });

    this.list.addEventListener('keydown', function (event) {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          self.moveActive(1);
          break;
        case 'ArrowUp':
          event.preventDefault();
          self.moveActive(-1);
          break;
        case 'Home':
          event.preventDefault();
          self.setActive(0);
          break;
        case 'End':
          event.preventDefault();
          self.setActive(self.items.length - 1);
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          self.select(self.activeIndex);
          self.close({ focusButton: true });
          break;
        case 'Escape':
          event.preventDefault();
          self.close({ focusButton: true });
          break;
        case 'Tab':
          self.close();
          break;
        default:
          break;
      }
    });

    /* Clicking anywhere else dismisses the list. */
    document.addEventListener('click', function (event) {
      if (!self.isOpen) return;
      if (self.root.contains(event.target)) return;
      self.close();
    });
  };

  ColorSelect.prototype.toggle = function () {
    if (this.isOpen) this.close({ focusButton: true });
    else this.open();
  };

  ColorSelect.prototype.open = function () {
    if (this.isOpen) return;
    this.isOpen = true;
    this.list.hidden = false;
    this.root.classList.add('is-open');
    this.button.setAttribute('aria-expanded', 'true');
    this.setActive(this.selectedIndex || 0);
  };

  ColorSelect.prototype.close = function (options) {
    if (!this.isOpen) return;
    var settings = options || {};
    this.isOpen = false;
    this.list.hidden = true;
    this.root.classList.remove('is-open');
    this.button.setAttribute('aria-expanded', 'false');
    if (settings.focusButton) this.button.focus();
  };

  ColorSelect.prototype.moveActive = function (delta) {
    var next = (this.activeIndex + delta + this.items.length) % this.items.length;
    this.setActive(next);
  };

  ColorSelect.prototype.setActive = function (index) {
    var item = this.items[index];
    if (!item) return;
    this.activeIndex = index;
    this.list.setAttribute('aria-activedescendant', item.id);
    item.focus();
  };

  ColorSelect.prototype.select = function (index, options) {
    var settings = options || {};
    var option = this.options[index];
    if (!option) return;

    this.selectedIndex = index;
    this.activeIndex = index;

    this.items.forEach(function (item, i) {
      item.setAttribute('aria-selected', i === index ? 'true' : 'false');
      item.classList.toggle('is-selected', i === index);
    });

    if (this.thumb) this.thumb.src = option.swatch;
    if (this.valueEl) this.valueEl.textContent = option.label;

    if (!settings.silent) this.onSelect(option.id);
  };

  ns.ColorSelect = ColorSelect;
})(window.Digicom = window.Digicom || {});
