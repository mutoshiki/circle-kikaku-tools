import { useEffect, useState } from 'react';

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function readSystemTheme() {
  return window.matchMedia?.(COLOR_SCHEME_QUERY).matches ? 'g100' : 'g10';
}

export default function useSystemTheme() {
  const [theme, setTheme] = useState(readSystemTheme);

  useEffect(() => {
    const colorScheme = window.matchMedia?.(COLOR_SCHEME_QUERY);
    if (!colorScheme) return undefined;
    const updateTheme = event => setTheme(event.matches ? 'g100' : 'g10');
    if (colorScheme.addEventListener) colorScheme.addEventListener('change', updateTheme);
    else colorScheme.addListener?.(updateTheme);
    return () => {
      if (colorScheme.removeEventListener) colorScheme.removeEventListener('change', updateTheme);
      else colorScheme.removeListener?.(updateTheme);
    };
  }, []);

  return theme;
}
