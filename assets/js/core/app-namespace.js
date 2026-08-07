// Central application namespace.
// Owns cross-file registries so feature files do not need to compete for globals.
(function (global) {
  'use strict';

  const existing = global.SanpoApp || {};
  const actions = existing.actions || Object.create(null);
  const renderers = existing.renderers || Object.create(null);
  const templates = existing.templates || Object.create(null);
  const compat = existing.compat || Object.create(null);

  const state = existing.state || {
    snapshot: null,
    restoring: false,
    setSnapshot(nextSnapshot) {
      this.snapshot = nextSnapshot || null;
      return this.snapshot;
    },
    capture() {
      if (typeof global.getData === 'function') {
        this.snapshot = global.getData();
      }
      return this.snapshot;
    },
    restore(nextSnapshot) {
      this.snapshot = nextSnapshot || null;
      if (typeof global.restore === 'function' && nextSnapshot) {
        this.restoring = true;
        try { global.restore(nextSnapshot); }
        finally { this.restoring = false; }
      }
      return this.snapshot;
    },
    patch(patchValue = {}) {
      const base = this.snapshot && typeof this.snapshot === 'object' ? this.snapshot : {};
      this.snapshot = { ...base, ...patchValue };
      return this.snapshot;
    }
  };

  function registerActions(nextActions = {}) {
    Object.entries(nextActions).forEach(([name, handler]) => {
      if (name && typeof handler === 'function') actions[name] = handler;
    });
    return actions;
  }

  function runAction(name, context = {}) {
    const handler = actions[name];
    if (typeof handler !== 'function') return false;
    handler(context);
    return true;
  }

  function registerRenderers(nextRenderers = {}) {
    Object.entries(nextRenderers).forEach(([name, handler]) => {
      if (name && typeof handler === 'function') renderers[name] = handler;
    });
    return renderers;
  }

  function registerTemplates(scope, nextTemplates = {}) {
    if (!scope) return templates;
    templates[scope] = { ...(templates[scope] || {}), ...nextTemplates };
    return templates[scope];
  }

  function exposeCompat(name, value) {
    if (!name) return value;
    compat[name] = value;
    global[name] = value;
    return value;
  }

  const api = {
    ...existing,
    actions,
    compat,
    renderers,
    state,
    templates,
    registerActions,
    runAction,
    registerRenderers,
    registerTemplates,
    exposeCompat
  };

  global.SanpoApp = api;
})(window);
