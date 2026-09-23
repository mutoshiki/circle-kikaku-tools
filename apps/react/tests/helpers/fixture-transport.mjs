const copy = value => structuredClone(value);
export function createFixtureServer(initial) {
  let value = copy(initial);
  let chain = Promise.resolve();
  let writes = 0;
  const clients = new Set();
  const notify = () => { for (const client of clients) client.deliver(value); };
  function connect() {
    let listener;
    let online = true;
    let nextError;
    let updates = 0;
    let subscriptions = 0;
    const client = {
      deliver(raw) { if (online && listener) queueMicrotask(() => listener?.(copy(raw))); },
      subscribe(fn) { subscriptions++; listener = fn; clients.add(client); client.deliver(value); return () => { subscriptions--; listener = null; clients.delete(client); }; },
      async transaction(updater) {
        const run = chain.then(() => {
          if (!online) throw new Error('disconnected');
          if (nextError) { const error = nextError; nextError = null; throw error; }
          const result = updater(copy(value));
          if (result !== undefined) { value = copy(result); writes++; notify(); }
          return { committed: result !== undefined, value: copy(value) };
        });
        chain = run.catch(() => {});
        return run;
      },
      async update(patch) {
        if (!online) throw new Error('disconnected');
        for (const [path, child] of Object.entries(patch)) {
          const keys = path.split('/');
          let cursor = value;
          for (const key of keys.slice(0, -1)) cursor = cursor[key] ||= {};
          if (child === null) delete cursor[keys.at(-1)]; else cursor[keys.at(-1)] = copy(child);
        }
        updates++; writes++; notify();
      },
      setOnline(next) { online = next; if (online) client.deliver(value); },
      failOnce(error) { nextError = error; },
      stats: () => ({ subscriptions, updates }),
    };
    return client;
  }
  return { connect, get: () => copy(value), writes: () => writes, replace(next) { value = copy(next); notify(); } };
}

export function memoryStorage() {
  const values = new Map();
  return { read: (key, fallback = null) => values.has(key) ? copy(values.get(key)) : fallback, write: (key, value) => values.set(key, copy(value)), remove: key => values.delete(key) };
}
