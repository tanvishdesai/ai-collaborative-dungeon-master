import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Collaborative Dungeon Master",
  description:
    "A real-time multiplayer fantasy storytelling game guided by an AI Dungeon Master.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en" className="dark">
        <body>
          <ConvexClientProvider>
            <Providers>{children}</Providers>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
