(function (global) {
  'use strict';

  const presets = [
    {
      scope: 'light',
      palette: 'standard',
      label: '標準',
      swatches: ['#305CDE', '#f3f6fb', '#ffffff'],
      previewMode: 'light'
    },
    {
      scope: 'light',
      palette: 'spinel-light',
      label: 'Spinel Light',
      swatches: ['#98A4BD', '#E3E2EC', '#DDDDDD'],
      previewMode: 'light'
    },
    {
      scope: 'light',
      palette: 'strawberry-matcha',
      label: 'Strawberry Matcha',
      swatches: ['#9BB957', '#F3F5E3', '#F7ABAB'],
      previewMode: 'light'
    },
    {
      scope: 'light',
      palette: 'earthbound-cave',
      label: 'Cave of the Past',
      swatches: ['#A5C4AD', '#B0D0B8', '#262E25'],
      previewMode: 'light'
    },
    {
      scope: 'dark',
      palette: 'standard',
      label: '標準',
      swatches: ['#8ab4ff', '#0b1120', '#111827'],
      previewMode: 'dark'
    },
    {
      scope: 'dark',
      palette: 'github-dark',
      label: 'GitHub Dark',
      swatches: ['#24292E', '#1B1F23', '#D1D5DA'],
      previewMode: 'dark'
    },
    {
      scope: 'dark',
      palette: 'night-owl-black',
      label: 'Night Owl Black',
      swatches: ['#131313', '#000000', '#82AAFF'],
      previewMode: 'dark'
    },
    {
      scope: 'dark',
      palette: 'synthwave-84',
      label: "SynthWave '84",
      swatches: ['#241B2F', '#262335', '#36F9F6'],
      previewMode: 'dark'
    }
  ];

  const defaultByScope = Object.freeze({
    light: 'standard',
    dark: 'standard'
  });

  const idsByScope = presets.reduce((acc, preset) => {
    if (!acc[preset.scope]) acc[preset.scope] = [];
    if (!acc[preset.scope].includes(preset.palette)) acc[preset.scope].push(preset.palette);
    return acc;
  }, Object.create(null));

  const allPaletteIds = [...new Set(presets.map(preset => preset.palette))];
  const labels = presets.reduce((acc, preset) => {
    if (!acc[preset.palette]) acc[preset.palette] = preset.label;
    return acc;
  }, Object.create(null));

  function normalizeScope(value) {
    return value === 'dark' ? 'dark' : 'light';
  }

  function normalizePalette(value, scope = 'light') {
    const normalizedScope = normalizeScope(scope);
    const allowed = idsByScope[normalizedScope] || [];
    return allowed.includes(value) ? value : defaultByScope[normalizedScope];
  }

  function getPresets(scope = 'light') {
    return presets.filter(preset => preset.scope === normalizeScope(scope));
  }

  function getLabel(value, scope = 'light') {
    const normalizedScope = normalizeScope(scope);
    const palette = normalizePalette(value, normalizedScope);
    return labels[palette] || labels[defaultByScope[normalizedScope]] || '標準';
  }

  window.SanpoThemePresets = presets;
  window.SanpoThemeRegistry = Object.freeze({
    presets,
    defaultByScope,
    idsByScope,
    labels,
    allPaletteIds,
    normalizeScope,
    normalizePalette,
    getPresets,
    getLabel
  });
})(window);
