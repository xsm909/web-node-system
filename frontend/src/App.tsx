import { useEffect } from 'react';
import Router from './app/Router';
import { useThemeStore } from './shared/lib/theme/store';

export default function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return <Router />;
}

