import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Audience Take — Find what should be made next",
  description:
    "Nominate overlooked screen projects and turn public evidence into a Scout Card the audience can champion.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
