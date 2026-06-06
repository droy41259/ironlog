import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { UnitsProvider } from "@/providers/UnitsProvider";
import { ToastProvider } from "@/providers/ToastProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "IronLog — Train smarter",
  description: "A modern, privacy-first lifting tracker with an AI coach.",
  applicationName: "IronLog",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IronLog",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Required so iOS exposes env(safe-area-inset-*) to CSS — the TopBar and
  // BottomNav already pad with those insets, but they read 0 without this, so
  // content would render under the status bar / Dynamic Island and home bar.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

// Initial theme: read from localStorage / OS pref BEFORE React hydrates,
// so we never flash the wrong palette.
const themeInit = `(function(){try{var t=localStorage.getItem('ironlog:theme');var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-sans antialiased">
        <ErrorBoundary>
          <ThemeProvider>
            <UnitsProvider>
              <AuthProvider>
                <ToastProvider>{children}</ToastProvider>
              </AuthProvider>
            </UnitsProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
