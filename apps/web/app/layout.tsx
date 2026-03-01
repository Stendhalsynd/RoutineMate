import "./globals.css";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { AppQueryProvider } from "@/components/query-provider";

export const metadata = {
  title: "RoutineMate",
  description: "Quick-log-first routine dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppQueryProvider>
          <AppNav />
          <main className="layout">{children}</main>
        </AppQueryProvider>
      </body>
    </html>
  );
}
