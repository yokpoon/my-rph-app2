import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'e-RPH SJKC YOK POON',
  description: 'Platform Pengurusan e-RPH SJK(C), Semakan PK Pentadbiran & Jadual Guru Ganti Berasaskan KPM DSKP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased selection:bg-[#f2b740] selection:text-[#16191d]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
