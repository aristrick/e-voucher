import './globals.css';
export const metadata = { title: 'Tiket Gathering' };
export default function Root({ children }) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
