/**
 * Shop the look — dialogs, variant sync, theme color swatch map.
 * One instance per section; config via data-* on <shop-the-look-root>.
 */

/** @type {Map<string, Promise<Record<string, string>>>} */
const colorMapPromises = new Map();

/**
 * @param {string} url
 * @returns {Promise<Record<string, string>>}
 */
function loadColorMap(url) {
  if (!colorMapPromises.has(url)) {
    const p = fetch(url)
      .then((r) => r.json())
      .catch(() => ({ default: '#BDBDBD' }));
    colorMapPromises.set(url, p);
  }
  return /** @type {Promise<Record<string, string>>} */ (colorMapPromises.get(url));
}

/**
 * @param {Record<string, string> | null} map
 * @param {string | null} value
 * @returns {string}
 */
function resolveSwatchHex(map, value) {
  if (!map || value == null || value === '') return (map && map.default) || '#BDBDBD';
  if (map[value]) return map[value];
  const v = String(value).trim();
  if (map[v]) return map[v];
  const lower = v.toLowerCase();
  for (const k of Object.keys(map)) {
    if (k === 'default') continue;
    if (String(k).toLowerCase() === lower) return map[k];
  }
  return map.default || '#BDBDBD';
}

/**
 * @param {HTMLElement} root
 * @param {string} mapUrl
 */
async function applyColorSwatches(root, mapUrl) {
  const map = await loadColorMap(mapUrl);
  root.querySelectorAll('.stl-swatch--color').forEach((btn) => {
    const val = btn.getAttribute('data-value');
    btn.style.setProperty('--stl-swatch', resolveSwatchHex(map, val));
  });
}

/**
 * @param {number} cents
 * @param {string} currency
 * @returns {string}
 */
function formatMoney(cents, currency) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
    }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2);
  }
}

/**
 * @param {string} id
 * @returns {unknown}
 */
function parseJsonById(id) {
  const el = document.getElementById(id);
  if (!el || !el.textContent) return null;
  try {
    return JSON.parse(el.textContent);
  } catch {
    return null;
  }
}

/**
 * @param {unknown[]} variants
 * @param {string[]} selected
 * @returns {Record<string, unknown> | null}
 */
function findVariant(variants, selected) {
  if (!Array.isArray(variants) || !selected.length) return null;
  const found = variants.find((v) => {
    if (!v || typeof v !== 'object') return false;
    const o = /** @type {Record<string, unknown>} */ (v);
    return selected.every((val, i) => {
      const key = `option${i + 1}`;
      return String(o[key]) === String(val);
    });
  });
  return /** @type {Record<string, unknown> | null} */ (found || null);
}

/**
 * @typedef {object} DialogOptions
 * @property {string} sectionId
 * @property {string} blockId
 * @property {string} currency
 * @property {string} addToCartLabel
 * @property {string} soldOutLabel
 */

/**
 * @param {HTMLDialogElement} dialog
 * @param {DialogOptions} opts
 */
function bindDialog(dialog, opts) {
  const { sectionId, blockId, currency, addToCartLabel, soldOutLabel } = opts;

  for (const btn of dialog.querySelectorAll('[data-stl-close]')) {
    btn.addEventListener('click', () => dialog.close());
  }

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  const form = dialog.querySelector('[data-stl-product-form]');
  if (!form) return;

  const variantInput = form.querySelector('[data-stl-variant-input]');
  const priceEl = dialog.querySelector('[data-stl-price]');
  const submitBtn = form.querySelector('[data-stl-submit]');
  const variants = parseJsonById(`stl-variants-${sectionId}-${blockId}`);
  const optionNames = parseJsonById(`stl-options-${sectionId}-${blockId}`);

  if (!variants || !Array.isArray(variants) || !variantInput) return;

  const optionCount = Array.isArray(optionNames) ? optionNames.length : 0;

  function currentSelection() {
    /** @type {string[]} */
    const optsOut = [];
    for (let i = 0; i < optionCount; i++) {
      const sw = dialog.querySelector(`.stl-swatches[data-stl-option-index="${i}"]`);
      const sel = dialog.querySelector(`select[data-stl-option-index="${i}"]`);
      if (sw) {
        const active = sw.querySelector('.stl-swatch[data-selected="true"]');
        optsOut.push(active ? active.getAttribute('data-value') || '' : '');
      } else if (sel) {
        optsOut.push(sel.value);
      } else {
        optsOut.push('');
      }
    }
    return optsOut;
  }

  function updateVariant() {
    const v = findVariant(
      /** @type {unknown[]} */ (variants),
      currentSelection()
    );
    if (!v) return;

    const id = v.id;
    const price = v.price;
    const available = v.available;

    variantInput.value = String(id);
    variantInput.disabled = !available;

    if (priceEl && typeof price === 'number') {
      priceEl.textContent = formatMoney(price, priceEl.getAttribute('data-currency') || currency);
    }

    if (submitBtn) {
      submitBtn.disabled = !available;
      const label = submitBtn.querySelector('.hb-btn__label');
      if (label) {
        label.textContent = available ? addToCartLabel : soldOutLabel;
      }
    }
  }

  for (const btn of dialog.querySelectorAll('.stl-swatch')) {
    btn.addEventListener('click', () => {
      const parent = btn.closest('.stl-swatches');
      if (!parent) return;
      parent.querySelectorAll('.stl-swatch').forEach((s) => {
        s.setAttribute('data-selected', 'false');
        s.setAttribute('aria-pressed', 'false');
      });
      btn.setAttribute('data-selected', 'true');
      btn.setAttribute('aria-pressed', 'true');
      updateVariant();
    });
  }

  for (const sel of dialog.querySelectorAll('select[data-stl-option-index]')) {
    sel.addEventListener('change', updateVariant);
  }
}

class ShopTheLookRoot extends HTMLElement {
  connectedCallback() {
    const sectionId = this.dataset.sectionId;
    const colorMapUrl = this.dataset.colorMapUrl;
    const currency = this.dataset.currency || 'USD';
    const addToCartLabel = this.dataset.addToCartLabel || 'Add to cart';
    const soldOutLabel = this.dataset.soldOutLabel || 'Sold out';

    if (!sectionId || !colorMapUrl) return;

    void applyColorSwatches(this, colorMapUrl);

    for (const dialog of this.querySelectorAll('[data-stl-dialog]')) {
      if (!(dialog instanceof HTMLDialogElement)) continue;
      const suffix = dialog.id.replace(`stl-dialog-${sectionId}-`, '');
      bindDialog(dialog, {
        sectionId,
        blockId: suffix,
        currency,
        addToCartLabel,
        soldOutLabel,
      });
    }

    for (const btn of this.querySelectorAll('[data-stl-open]')) {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-stl-open');
        if (!id) return;
        const dlg = document.getElementById(`stl-dialog-${sectionId}-${id}`);
        if (dlg instanceof HTMLDialogElement && typeof dlg.showModal === 'function') {
          dlg.showModal();
        }
      });
    }
  }
}

if (!customElements.get('shop-the-look-root')) {
  customElements.define('shop-the-look-root', ShopTheLookRoot);
}
