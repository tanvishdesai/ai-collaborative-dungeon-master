"use client";

import { ReactNode } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { BackButton } from "@/components/ui/back-button";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <BackButton />
      {children}
    </AuthProvider>
  );
}
