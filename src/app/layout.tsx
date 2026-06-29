import "./globals.css";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "../hexclave";
import type { Metadata } from "next";
import ThemeProvider from "../components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Untis to Calendar",
  description: "Sync your untis timetable with your calendar",
  icons: {
    icon: "/logo.webp",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <HexclaveProvider app={hexclaveServerApp}>
            <HexclaveTheme>
              {children}
              <Toaster />
            </HexclaveTheme>
          </HexclaveProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
