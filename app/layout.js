import './theme.css';
import { UIProvider } from './admin/ui';
export const metadata = { title: 'Tiket Gathering', description: 'E-tiket, check-in, kupon, dan undian doorprize' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#C8E64A' };
export default function Root({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" />
      </head>
      <body>
        <UIProvider>{children}</UIProvider>
        <footer className="credit">Setia Kawan Project by Aris Setiawan</footer>
      </body>
    </html>
  );
}
