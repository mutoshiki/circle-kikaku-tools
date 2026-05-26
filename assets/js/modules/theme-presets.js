// Theme preset registry and card renderer
//
// A-cleanup owner: this file is the single source of truth for theme presets,
// palette labels, allowed light/dark ids, and legacy palette aliases.
// appearance.js consumes window.SanpoThemeRegistry instead of keeping duplicate
// theme arrays. Keep CSS variable definitions and palette-related styles in assets/css/theme/*.
(function () {
  'use strict';

  const THEME_PRESETS = [
  {
    "scope": "dark",
    "palette": "natural",
    "label": "標準",
    "description": "既定のダーク。",
    "swatches": [
      "#305CDE",
      "#0b1020",
      "#111827"
    ]
  },
  {
    "scope": "dark",
    "palette": "gameboy-classic",
    "label": "GameBoy",
    "description": "レトロな緑。",
    "swatches": [
      "#8fbf45",
      "#0f1d12",
      "#18341d"
    ]
  },
  {
    "scope": "dark",
    "palette": "eight-bit",
    "label": "8-Bit",
    "description": "黒とネオン。",
    "swatches": [
      "#22ff22",
      "#000000",
      "#050505"
    ]
  },
  {
    "scope": "dark",
    "palette": "earthbound",
    "label": "Earthbound",
    "description": "暗い紫。",
    "swatches": [
      "#8f5cff",
      "#12091d",
      "#211431"
    ]
  },
  {
    "scope": "dark",
    "palette": "everforest",
    "label": "Everforest",
    "description": "深い森色。",
    "swatches": [
      "#a7c080",
      "#2d353b",
      "#343f44"
    ]
  },
  {
    "scope": "dark",
    "palette": "horizon",
    "label": "Horizon",
    "description": "赤みのある暗色。",
    "swatches": [
      "#e95678",
      "#1c1e26",
      "#232530"
    ]
  },
  {
    "scope": "dark",
    "palette": "warm-burnout",
    "label": "Warm Burnout",
    "description": "淡い焼き色。",
    "swatches": [
      "#e07a4f",
      "#241a16",
      "#33241e"
    ]
  },
  {
    "scope": "dark",
    "palette": "anthropic-warm",
    "label": "Anthropic",
    "description": "紙面に近い暖色。",
    "swatches": [
      "#d98263",
      "#1f1b17",
      "#2d2721"
    ]
  },
  {
    "scope": "dark",
    "palette": "gruvbox-material",
    "label": "Gruvbox",
    "description": "くすんだ黄土色。",
    "swatches": [
      "#d8a657",
      "#282828",
      "#32302f"
    ]
  },
  {
    "scope": "dark",
    "palette": "claude-warm",
    "label": "Claude Warm",
    "description": "落ち着いたベージュ。",
    "swatches": [
      "#d97757",
      "#211b16",
      "#302720"
    ]
  },
  {
    "scope": "dark",
    "palette": "skyblue",
    "label": "SkyBlue",
    "description": "爽やかな青。",
    "swatches": [
      "#58b6ff",
      "#0b1f33",
      "#102f4c"
    ]
  },
  {
    "scope": "dark",
    "palette": "retro-keyboard",
    "label": "Retro Keyboard",
    "description": "古いキーボード風。",
    "swatches": [
      "#d7a35d",
      "#1f1a14",
      "#2b251e"
    ]
  },
  {
    "scope": "dark",
    "palette": "candy-pop",
    "label": "Candy Pop",
    "description": "明るいピンク。",
    "swatches": [
      "#f472b6",
      "#251323",
      "#382035"
    ]
  },
  {
    "scope": "dark",
    "palette": "graphite-red",
    "label": "Graphite Red",
    "description": "灰色と赤。",
    "swatches": [
      "#f87171",
      "#171717",
      "#242424"
    ]
  },
  {
    "scope": "dark",
    "palette": "dark-plus",
    "label": "Dark+",
    "description": "VS Code標準。",
    "swatches": [
      "#007acc",
      "#1e1e1e",
      "#252526"
    ]
  },
  {
    "scope": "dark",
    "palette": "github",
    "label": "GitHub Dark",
    "description": "見慣れた配色。",
    "swatches": [
      "#2f81f7",
      "#0d1117",
      "#161b22"
    ]
  },
  {
    "scope": "dark",
    "palette": "one-dark",
    "label": "One Dark Pro",
    "description": "定番ダーク。",
    "swatches": [
      "#61afef",
      "#282c34",
      "#21252b"
    ]
  },
  {
    "scope": "dark",
    "palette": "dracula",
    "label": "Dracula",
    "description": "紫系。",
    "swatches": [
      "#bd93f9",
      "#282a36",
      "#343746"
    ]
  },
  {
    "scope": "dark",
    "palette": "tokyo-night",
    "label": "Tokyo Night",
    "description": "青紫で落ち着く。",
    "swatches": [
      "#7aa2f7",
      "#1a1b26",
      "#24283b"
    ]
  },
  {
    "scope": "dark",
    "palette": "night-owl",
    "label": "Night Owl",
    "description": "深い青。",
    "swatches": [
      "#82aaff",
      "#011627",
      "#0b253a"
    ]
  },
  {
    "scope": "dark",
    "palette": "monokai-pro",
    "label": "Monokai Pro",
    "description": "高コントラスト。",
    "swatches": [
      "#ffd866",
      "#2d2a2e",
      "#403e41"
    ]
  },
  {
    "scope": "dark",
    "palette": "catppuccin",
    "label": "Catppuccin",
    "description": "柔らかい色。",
    "swatches": [
      "#cba6f7",
      "#1e1e2e",
      "#313244"
    ]
  },
  {
    "scope": "light",
    "palette": "natural",
    "label": "標準",
    "description": "既定のライト。",
    "swatches": [
      "#305CDE",
      "#f6f7fb",
      "#ffffff"
    ]
  },
  {
    "scope": "light",
    "palette": "gameboy-classic",
    "label": "GameBoy",
    "description": "淡い黄緑。",
    "swatches": [
      "#5d4a9b",
      "#f0f4e8",
      "#d2df9f"
    ]
  },
  {
    "scope": "light",
    "palette": "eight-bit",
    "label": "8-Bit",
    "description": "白と原色。",
    "swatches": [
      "#165dff",
      "#ffffff",
      "#fff200"
    ]
  },
  {
    "scope": "light",
    "palette": "earthbound",
    "label": "Earthbound",
    "description": "柔らかい緑。",
    "swatches": [
      "#5f806b",
      "#edf4ed",
      "#c7ddc7"
    ]
  },
  {
    "scope": "light",
    "palette": "everforest",
    "label": "Everforest",
    "description": "温かい森色。",
    "swatches": [
      "#8da101",
      "#fff8dc",
      "#f3efcf"
    ]
  },
  {
    "scope": "light",
    "palette": "horizon",
    "label": "Horizon",
    "description": "淡いピンク。",
    "swatches": [
      "#e95678",
      "#fff5f7",
      "#fff0f3"
    ]
  },
  {
    "scope": "light",
    "palette": "warm-burnout",
    "label": "Warm Burnout",
    "description": "淡い焼き色。",
    "swatches": [
      "#c76843",
      "#f6efe5",
      "#fffaf2"
    ]
  },
  {
    "scope": "light",
    "palette": "anthropic-warm",
    "label": "Anthropic",
    "description": "紙面に近い暖色。",
    "swatches": [
      "#c96f50",
      "#f7f3ea",
      "#fffdf8"
    ]
  },
  {
    "scope": "light",
    "palette": "gruvbox-material",
    "label": "Gruvbox",
    "description": "くすんだ黄土色。",
    "swatches": [
      "#b57614",
      "#f9f5d7",
      "#fff9d9"
    ]
  },
  {
    "scope": "light",
    "palette": "claude-warm",
    "label": "Claude Warm",
    "description": "落ち着いたベージュ。",
    "swatches": [
      "#b8623d",
      "#f5efe6",
      "#fffaf4"
    ]
  },
  {
    "scope": "light",
    "palette": "skyblue",
    "label": "SkyBlue",
    "description": "爽やかな青。",
    "swatches": [
      "#1f6aa5",
      "#eef8ff",
      "#ffffff"
    ]
  },
  {
    "scope": "light",
    "palette": "retro-keyboard",
    "label": "Retro Keyboard",
    "description": "古いキーボード風。",
    "swatches": [
      "#8b5e34",
      "#f4efe4",
      "#fffaf0"
    ]
  },
  {
    "scope": "light",
    "palette": "candy-pop",
    "label": "Candy Pop",
    "description": "明るいピンク。",
    "swatches": [
      "#d9468f",
      "#fff0f7",
      "#fffafd"
    ]
  },
  {
    "scope": "light",
    "palette": "graphite-red",
    "label": "Graphite Red",
    "description": "灰色と赤。",
    "swatches": [
      "#c73b3b",
      "#f5f5f5",
      "#ffffff"
    ]
  },
  {
    "scope": "light",
    "palette": "light-plus",
    "label": "Light+",
    "description": "VS Code標準。",
    "swatches": [
      "#007acc",
      "#ffffff",
      "#f3f3f3"
    ]
  },
  {
    "scope": "light",
    "palette": "github",
    "label": "GitHub Light",
    "description": "すっきり。",
    "swatches": [
      "#0969da",
      "#f6f8fa",
      "#ffffff"
    ]
  },
  {
    "scope": "light",
    "palette": "ayu",
    "label": "Ayu Light",
    "description": "明るい暖色。",
    "swatches": [
      "#ff9940",
      "#fafafa",
      "#ffffff"
    ]
  },
  {
    "scope": "light",
    "palette": "solarized",
    "label": "Solarized Light",
    "description": "目に優しい。",
    "swatches": [
      "#268bd2",
      "#fdf6e3",
      "#fffdf2"
    ]
  },
  {
    "scope": "light",
    "palette": "catppuccin",
    "label": "Catppuccin",
    "description": "柔らかい淡色。",
    "swatches": [
      "#8839ef",
      "#eff1f5",
      "#ffffff"
    ]
  }
];

  const PALETTE_ALIASES = {
    minimal: 'github',
    autumn: 'solarized',
    contrast: 'dark-plus',
    nord: 'github',
    monochrome: 'dark-plus',
    line: 'natural',
    sakura: 'catppuccin',
    forest: 'everforest',
    mountain: 'tokyo-night',
    ocean: 'github',
    amber: 'ayu',
    vscode: { light: 'light-plus', dark: 'dark-plus' }
  };

  function buildRegistry(presets) {
    const byScope = presets.reduce((acc, preset) => {
      const scope = preset.scope === 'dark' ? 'dark' : 'light';
      if (!acc[scope]) acc[scope] = [];
      acc[scope].push(Object.freeze({ ...preset }));
      return acc;
    }, { light: [], dark: [] });

    const idsByScope = {
      light: byScope.light.map(preset => preset.palette),
      dark: byScope.dark.map(preset => preset.palette)
    };

    const labels = {};
    presets.forEach(preset => {
      if (!labels[preset.palette]) labels[preset.palette] = preset.label;
      if (preset.scope === 'light' && preset.palette === 'github') labels.github = 'GitHub';
      if (preset.scope === 'dark' && preset.palette === 'dark-plus') labels['dark-plus'] = 'Dark+';
      if (preset.scope === 'light' && preset.palette === 'light-plus') labels['light-plus'] = 'Light+';
    });

    function resolveAlias(value, scope = 'light') {
      const raw = value || 'natural';
      const alias = PALETTE_ALIASES[raw];
      if (!alias) return raw;
      if (typeof alias === 'string') return alias;
      return alias[scope === 'dark' ? 'dark' : 'light'] || 'natural';
    }

    function normalizePalette(value, scope = 'light') {
      const normalizedScope = scope === 'dark' ? 'dark' : 'light';
      const raw = resolveAlias(value, normalizedScope);
      return idsByScope[normalizedScope].includes(raw) ? raw : 'natural';
    }

    function getLabel(palette, fallback = '標準') {
      return labels[palette] || fallback;
    }

    return Object.freeze({
      presets: Object.freeze(presets.map(preset => Object.freeze({ ...preset }))),
      byScope: Object.freeze({
        light: Object.freeze(byScope.light.slice()),
        dark: Object.freeze(byScope.dark.slice())
      }),
      idsByScope: Object.freeze({
        light: Object.freeze(idsByScope.light.slice()),
        dark: Object.freeze(idsByScope.dark.slice())
      }),
      labels: Object.freeze({ ...labels }),
      aliases: Object.freeze({ ...PALETTE_ALIASES }),
      normalizePalette,
      getLabel
    });
  }

  const THEME_REGISTRY = buildRegistry(THEME_PRESETS);

  function createSwatch(color) {
    const swatch = document.createElement('span');
    swatch.className = 'theme-swatch';
    swatch.style.backgroundColor = color;
    return swatch;
  }

  function createPresetCard(preset) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-preset-card';
    button.dataset.themeScope = preset.scope;
    button.dataset.themePalette = preset.palette;

    const swatchRow = document.createElement('span');
    swatchRow.className = 'theme-swatch-row';
    (preset.swatches || []).forEach(color => swatchRow.appendChild(createSwatch(color)));

    const main = document.createElement('span');
    main.className = 'theme-preset-main';

    const label = document.createElement('strong');
    label.textContent = preset.label;
    main.appendChild(label);

    const description = document.createElement('small');
    description.textContent = preset.description;
    main.appendChild(description);

    button.append(swatchRow, main);
    return button;
  }

  function renderThemePresetLists() {
    document.querySelectorAll('[data-theme-preset-list]').forEach(container => {
      const scope = container.dataset.themePresetList === 'dark' ? 'dark' : 'light';
      const fragment = document.createDocumentFragment();
      THEME_REGISTRY.byScope[scope].forEach(preset => fragment.appendChild(createPresetCard(preset)));
      container.replaceChildren(fragment);
    });
  }

  window.SanpoThemeRegistry = THEME_REGISTRY;
  window.SanpoThemePresets = THEME_REGISTRY.presets;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderThemePresetLists, { once: true });
  } else {
    renderThemePresetLists();
  }
})();
