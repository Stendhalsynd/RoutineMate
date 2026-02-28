import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "RoutineMate",
  description: "Quick-log-first routine dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
