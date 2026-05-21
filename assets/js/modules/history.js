// History helpers. Classic-script module for compatibility with current app.js.
(function () {
  const api = {
    key(roomId) {
      return 'syawari_history_' + roomId;
    },
    read(roomId) {
      try {
        return JSON.parse(localStorage.getItem(api.key(roomId)) || '[]');
      } catch (error) {
        console.warn('History read failed:', error);
        return [];
      }
    },
    write(roomId, history) {
      try {
        localStorage.setItem(api.key(roomId), JSON.stringify(Array.isArray(history) ? history : []));
        return true;
      } catch (error) {
        console.warn('History write failed:', error);
        return false;
      }
    },
    clear(roomId) {
      try {
        localStorage.removeItem(api.key(roomId));
        return true;
      } catch (error) {
        console.warn('History clear failed:', error);
        return false;
      }
    },
    summarize(item) {
      const data = item?.data || {};
      const cars = Array.isArray(data.cars) ? data.cars.length : 0;
      const waiting = Array.isArray(data.waiting) ? data.waiting.length : 0;
      const assigned = Array.isArray(data.cars)
        ? data.cars.reduce((sum, car) => sum + (Array.isArray(car.members) ? car.members.length : 0), 0)
        : 0;
      return { cars, waiting, assigned, total: waiting + assigned };
    }
  };

  window.SanpoHistory = api;
})();
