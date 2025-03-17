// src/app/layout.tsx
import SolanaProviders from '@/app/components/SolanaProviders';
import './globals.css';

export const metadata = {
  title: 'Solana Video Chat',
  description: 'On-chain video chat platform on Solana',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SolanaProviders>
          {children}
        </SolanaProviders>
      </body>
    </html>
  );
}