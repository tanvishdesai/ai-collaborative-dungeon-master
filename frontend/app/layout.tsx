import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Abhyaas — AI Placement Practice",
  description:
    "Practice campus placement panel interviews and group discussions with an AI panel that remembers and probes your answers, then get a scored feedback report.",
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
