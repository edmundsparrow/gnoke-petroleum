/**
 * db.js — Gnoke Petroleum
 * All database operations live here. Nothing outside this file
 * touches SQL directly. Persists the SQLite binary to IndexedDB
 * after every write so data survives page reloads.
 *
 * Requires: sql-wasm.js (SQL.js library) loaded before this file.
 *
 * Public API:
 *   await DB.init()
 *   await DB.saveRecord(date, productId, unitId, amount)
 *   await DB.getDay(date, productId)          → [{unitId, amount}]
 *   await DB.getRange(startDate, endDate, productId) → [{date, unitId, amount}]
 *   await DB.getAllTime(productId)             → [{unitId, total}]
 *   await DB.getUnitCount(productId)          → number
 *   await DB.setUnitCount(productId, count)
 *   await DB.getUnitName(productId, unitId)   → string
 *   await DB.setUnitName(productId, unitId, name)
 *   DB.exportCSV(productId)                   → CSV string
 */

const DB = (() => {

  const IDB_NAME    = GP.DB_NAME;
  const IDB_STORE   = 'sqlite_binary';
  const IDB_KEY     = 'db';

  let _sql = null;   // sql.js module
  let _db  = null;   // sql.js Database instance

  /* ════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════ */
  async function init() {
    // Load sql.js WASM module.
    // Points to CDN so no local /lib/ folder is needed.
    // For full offline: download sql-wasm.wasm into /lib/ and change to:
    //   locateFile: file => `lib/${file}`
    _sql = await initSqlJs({
      locateFile: file =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${file}`
    });

    // Try to restore existing DB from IndexedDB
    const saved = await _idbLoad();

    if (saved) {
      _db = new _sql.Database(saved);
    } else {
      _db = new _sql.Database();
    }

    _migrate();
    return true;
  }

  /* ════════════════════════════════════════════════
     SCHEMA MIGRATION
     Safe to run on every init — uses IF NOT EXISTS
  ════════════════════════════════════════════════ */
  function _migrate() {
    _db.run(`
      CREATE TABLE IF NOT EXISTS records (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        date       TEXT    NOT NULL,
        product    TEXT    NOT NULL,
        unit_id    INTEGER NOT NULL,
        amount     REAL    NOT NULL DEFAULT 0,
        UNIQUE(date, product, unit_id)
      );

      CREATE TABLE IF NOT EXISTS unit_settings (
        product    TEXT    NOT NULL,
        unit_id    INTEGER NOT NULL,
        name       TEXT    DEFAULT '',
        PRIMARY KEY (product, unit_id)
      );

      CREATE TABLE IF NOT EXISTS product_settings (
        product    TEXT    PRIMARY KEY,
        unit_count INTEGER NOT NULL DEFAULT 1
      );
    `);

    /* Seed default unit counts from config if not already set */
    GP.PRODUCTS.forEach(p => {
      const exists = _db.exec(
        `SELECT 1 FROM product_settings WHERE product = ?`, [p.id]
      );
      if (!exists.length) {
        _db.run(
          `INSERT INTO product_settings (product, unit_count) VALUES (?, ?)`,
          [p.id, p.defaultUnits]
        );
      }
    });

    _persist();
  }

  /* ════════════════════════════════════════════════
     RECORDS
  ════════════════════════════════════════════════ */

  async function saveRecord(date, productId, unitId, amount) {
    _db.run(`
      INSERT INTO records (date, product, unit_id, amount)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date, product, unit_id) DO UPDATE SET amount = excluded.amount
    `, [date, productId, unitId, amount]);
    await _persist();
  }

  function getDay(date, productId) {
    const res = _db.exec(
      `SELECT unit_id, amount FROM records
       WHERE date = ? AND product = ?
       ORDER BY unit_id`, [date, productId]
    );
    return _rows(res);
  }

  function getRange(startDate, endDate, productId) {
    const res = _db.exec(
      `SELECT date, unit_id, amount FROM records
       WHERE product = ? AND date >= ? AND date <= ?
       ORDER BY date, unit_id`,
      [productId, startDate, endDate]
    );
    return _rows(res);
  }

  function getAllTime(productId) {
    const res = _db.exec(
      `SELECT unit_id, SUM(amount) as total FROM records
       WHERE product = ?
       GROUP BY unit_id
       ORDER BY unit_id`,
      [productId]
    );
    return _rows(res);
  }

  /* ════════════════════════════════════════════════
     SETTINGS — unit counts
  ════════════════════════════════════════════════ */

  function getUnitCount(productId) {
    const res = _db.exec(
      `SELECT unit_count FROM product_settings WHERE product = ?`,
      [productId]
    );
    const rows = _rows(res);
    return rows.length ? rows[0].unit_count : GP.product(productId).defaultUnits;
  }

  async function setUnitCount(productId, count) {
    _db.run(
      `INSERT INTO product_settings (product, unit_count) VALUES (?, ?)
       ON CONFLICT(product) DO UPDATE SET unit_count = excluded.unit_count`,
      [productId, count]
    );
    await _persist();
  }

  /* ════════════════════════════════════════════════
     SETTINGS — unit names
  ════════════════════════════════════════════════ */

  function getUnitName(productId, unitId) {
    const res = _db.exec(
      `SELECT name FROM unit_settings WHERE product = ? AND unit_id = ?`,
      [productId, unitId]
    );
    const rows = _rows(res);
    return rows.length && rows[0].name ? rows[0].name : '';
  }

  async function setUnitName(productId, unitId, name) {
    _db.run(
      `INSERT INTO unit_settings (product, unit_id, name) VALUES (?, ?, ?)
       ON CONFLICT(product, unit_id) DO UPDATE SET name = excluded.name`,
      [productId, unitId, name]
    );
    await _persist();
  }

  /* ════════════════════════════════════════════════
     EXPORT
  ════════════════════════════════════════════════ */

  function exportCSV(productId) {
    const res = _db.exec(
      `SELECT r.date, r.unit_id, COALESCE(u.name,'') as name, r.amount
       FROM records r
       LEFT JOIN unit_settings u ON u.product = r.product AND u.unit_id = r.unit_id
       WHERE r.product = ?
       ORDER BY r.date, r.unit_id`,
      [productId]
    );
    const rows = _rows(res);
    if (!rows.length) return null;

    const p = GP.product(productId);
    const lines = ['Date,Unit,Attendant,Amount (₦)'];
    rows.forEach(r => {
      const label = r.name || GP.unitLabel(productId, r.unit_id);
      lines.push(`${r.date},${GP.unitLabel(productId, r.unit_id)},${label},${r.amount}`);
    });
    return lines.join('\n');
  }

  /* ════════════════════════════════════════════════
     INDEXEDDB PERSISTENCE
  ════════════════════════════════════════════════ */

  function _persist() {
    return new Promise((resolve, reject) => {
      const data = _db.export();
      const req  = indexedDB.open(IDB_NAME, 1);

      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(IDB_STORE);
      };

      req.onsuccess = e => {
        const tx    = e.target.result.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        store.put(data, IDB_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror    = () => reject(tx.error);
      };

      req.onerror = () => reject(req.error);
    });
  }

  function _idbLoad() {
    return new Promise((resolve) => {
      const req = indexedDB.open(IDB_NAME, 1);

      req.onupgradeneeded = e => {
        e.target.result.createObjectStore(IDB_STORE);
      };

      req.onsuccess = e => {
        const tx    = e.target.result.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const get   = store.get(IDB_KEY);
        get.onsuccess = () => resolve(get.result || null);
        get.onerror   = () => resolve(null);
      };

      req.onerror = () => resolve(null);
    });
  }

  /* ════════════════════════════════════════════════
     UTILITY — convert sql.js result to plain objects
  ════════════════════════════════════════════════ */

  function _rows(result) {
    if (!result || !result.length) return [];
    const { columns, values } = result[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  /* ── Public API ── */
  return {
    init, saveRecord,
    getDay, getRange, getAllTime,
    getUnitCount, setUnitCount,
    getUnitName, setUnitName,
    exportCSV,
  };

})();
