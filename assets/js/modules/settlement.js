// Settlement helpers that are safe to share outside app.js.
(function () {
  window.SanpoSettlement = {
    yen(value) {
      return '¥' + Math.round(Number(value) || 0).toLocaleString();
    },
    number(value, fallback = 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    },
    clampNonNegative(value) {
      return Math.max(0, Number(value) || 0);
    }
  };
})();
