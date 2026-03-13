/**
 * config.js — Gnoke Petroleum
 * Single source of truth for all product definitions and app constants.
 * To add a new product: add one entry to PRODUCTS. Nothing else changes.
 */

const GP = {

  APP_NAME    : 'Gnoke Petroleum',
  APP_VERSION : 'v1.0',
  DB_NAME     : 'gnoke_petroleum_db',   // IndexedDB store key
  SKIP_KEY    : 'gnoke_petroleum_skip', // localStorage intro skip

  /* ── Products ──────────────────────────────────────────────────
     id          : internal key, used in DB and DOM
     label       : short display name (used in selector)
     full        : full name (used in headings)
     icon        : emoji
     defaultUnits: how many pumps/points created by default
     minUnits    : minimum — user cannot go below this
     unitPrefix  : label prefix for each unit (e.g. "Pump 1", "Point A")
     useAlpha    : if true, units are labelled A, B, C… instead of 1, 2, 3…
  ─────────────────────────────────────────────────────────────── */
  PRODUCTS: [
    {
      id          : 'pms',
      label       : 'PMS',
      full        : 'PMS — Petrol',
      icon        : '⛽',
      defaultUnits: 4,
      minUnits    : 1,
      unitPrefix  : 'Pump',
      useAlpha    : false,
    },
    {
      id          : 'ago',
      label       : 'AGO',
      full        : 'AGO — Diesel',
      icon        : '🛢️',
      defaultUnits: 2,
      minUnits    : 1,
      unitPrefix  : 'Pump',
      useAlpha    : false,
    },
    {
      id          : 'kerosene',
      label       : 'Kerosene',
      full        : 'Kerosene',
      icon        : '🪔',
      defaultUnits: 1,
      minUnits    : 1,
      unitPrefix  : 'Pump',
      useAlpha    : false,
    },
    {
      id          : 'lpg',
      label       : 'LPG',
      full        : 'LPG — Cooking Gas',
      icon        : '🔵',
      defaultUnits: 2,
      minUnits    : 1,
      unitPrefix  : 'Point',
      useAlpha    : true,
    },
  ],

  /* ── Currency ── */
  CURRENCY: '₦',

  /* ── Helper: get product def by id ── */
  product(id) {
    return this.PRODUCTS.find(p => p.id === id) || this.PRODUCTS[0];
  },

  /* ── Helper: get unit display label ── */
  unitLabel(productId, unitIndex) {
    const p = this.product(productId);
    if (p.useAlpha) {
      return `${p.unitPrefix} ${String.fromCharCode(64 + unitIndex)}`;
    }
    return `${p.unitPrefix} ${unitIndex}`;
  },

};
