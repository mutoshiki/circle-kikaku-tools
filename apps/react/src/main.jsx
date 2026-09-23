import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.scss';
import { createRuntime } from './runtime.js';
import { createConfiguredRouteService } from './route/google-maps-adapter.js';
import { InlineNotification, Theme } from '@carbon/react';

const root = createRoot(document.getElementById('root'));
try {
  const testAdaptersEnabled = import.meta.env.MODE === 'test';
  const routeService = (testAdaptersEnabled && window.__REACT_ROUTE_ADAPTER__) || createConfiguredRouteService(import.meta.env, { browser: window, document });
  const externalAdapters = testAdaptersEnabled ? window.__REACT_EXTERNAL_ADAPTERS__ || {} : {};
  const runtime = await createRuntime({ location, history, storage: localStorage, crypto, routeService, externalAdapters });
  runtime.start();
  if (import.meta.hot) import.meta.hot.dispose(() => { void runtime.dispose(); });
  root.render(<React.StrictMode><App runtime={runtime} /></React.StrictMode>);
} catch (error) {
  root.render(<Theme theme="g10"><InlineNotification kind="error" title="企画を開けませんでした" subtitle={String(error.message || error)} hideCloseButton /></Theme>);
}
