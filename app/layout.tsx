import type { Metadata } from "next";

import "@/app/globals.css";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Drop",
  description: "A private cross-device clipboard for text, files, folders, and screenshots.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
        )}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
