import "./globals.css";
import type { ReactNode } from "react";
import { AppNav } from "@/components/app-nav";

export const metadata = {
  title: "RoutineMate",
  description: "Quick-log-first routine dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        <main className="layout">{children}</main>
      </body>
    </html>
  );
}
