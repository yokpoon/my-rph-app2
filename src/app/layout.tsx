import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'e-RPH SJK(C) — Sistem Pengurusan e-RPH, Jadual & Guru Ganti',
  description: 'Platform Pengurusan e-RPH SJK(C), Semakan PK Pentadbiran & Jadual Guru Ganti Berasaskan KPM DSKP',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <body className="antialiased selection:bg-cyan-500 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
