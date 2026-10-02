/**
 * Sauvegarde locale (localStorage) : carrière, ceinture, son, touches.
 */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } },
};
const SAVE_KEY = 'dohyo.v2.save';
const save = Object.assign({ skin: 'rouge', muted: false, career: null }, store.get(SAVE_KEY, {}));
const persist = () => store.set(SAVE_KEY, save);

export { persist, save };
