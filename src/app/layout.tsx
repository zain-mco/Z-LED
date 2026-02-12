import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Z-LED Digital Signage',
  description: 'Conference digital signage management system',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
