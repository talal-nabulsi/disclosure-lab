import type { Metadata } from 'next';
import { DM_Mono, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
});

const dmMono = DM_Mono({
  variable: '--font-dm-mono',
  subsets: ['latin'],
  weight: ['300', '400', '500'],
});

export const metadata: Metadata = {
  title: 'Disclosure Lab — Test the trade. Test the timing.',
  description:
    'An auditable political stock-trading research lab comparing reported transaction dates with disclosure-date execution.',
  openGraph: {
    title: 'Thesis Lab',
    description: 'Turn a market hunch into a test.',
    images: [
      {
        url: '/og.png',
        width: 1680,
        height: 945,
        alt: 'Thesis Lab — Turn a market hunch into a test.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Thesis Lab',
    description: 'Turn a market hunch into a test.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${dmMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
