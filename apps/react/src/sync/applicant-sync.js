// Application metadata has its own remote owner. Derived accepted-participant
// fields still use ordinary canonical commands and entity patches.
export function createApplicantSync({ store, transport, onError = () => {} }) {
  let stopRoom;
  let stopMetadata;
  let running = false;
  let applying = false;
  function reconcile() {
    if (!running || applying) return;
    applying = true;
    try { store.command('syncApplicantDetails'); }
    catch (error) { onError(error); }
    finally { applying = false; }
  }
  return Object.freeze({
    start() {
      if (running) return;
      running = true;
      stopRoom = store.subscribe(reconcile);
      stopMetadata = transport?.subscribeApplicationMetadata(value => { if (running) store.receiveApplicationMetadata(value); }, onError);
      reconcile();
    },
    dispose() { running = false; stopRoom?.(); stopMetadata?.(); stopRoom = null; stopMetadata = null; },
  });
}
