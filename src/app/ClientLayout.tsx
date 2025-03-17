"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";

// Dynamically import the WalletContextProvider with SSR disabled
const WalletContextProvider = dynamic(
  () => import("./providers/WalletProvider").then((mod) => mod.WalletContextProvider),
  { ssr: false }
);

export default function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
} 