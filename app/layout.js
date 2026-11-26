import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/700.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/700.css';
import './theme.css';
import { UIProvider } from './admin/ui';
export const metadata = { title: 'Tiket Gathering', description: 'E-tiket, check-in, kupon, dan undian doorprize' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#C8E64A' };
export default function Root({ children }) {
  return (
    <html lang="id">
      <body>
        <UIProvider>{children}</UIProvider>
        <footer className="credit">Setia Kawan Project by Aris Setiawan</footer>
      </body>
    </html>
  );
}
