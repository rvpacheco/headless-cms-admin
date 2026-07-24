import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/app-shell/SidebarNav";
import { listSchemas } from "@/lib/db/schemas";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Content Admin",
  description: "Admin panel for a small headless CMS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The app shell reads the schema list once and shares it with the sidebar
  // across navigations. Server Component: reads the repository directly.
  const schemas = listSchemas().map((s) => ({ id: s.id, name: s.name }));

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <aside className="w-64 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <SidebarNav schemas={schemas} />
          </aside>
          <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">{children}</main>
        </div>
      </body>
    </html>
  );
}
