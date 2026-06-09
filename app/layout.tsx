import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import "./globals.css";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบตารางเรียนตารางสอน (TMS)",
  description: "ระบบแสดงและแก้ไขตารางเรียนตารางสอน สาขาวิศวกรรมคอมพิวเตอร์",
};

const nav = [
  { href: "/", label: "ตาราง" },
  { href: "/overview", label: "ภาพรวม" },
  { href: "/masters", label: "ข้อมูลหลัก" },
  { href: "/sheet", label: "ใบตารางสอน" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`h-full antialiased ${sarabun.variable}`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="no-print border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <span className="font-semibold">ระบบตารางเรียนตารางสอน</span>
            <nav className="flex gap-4 text-sm text-zinc-600">
              {nav.map((item) => (
                <a key={item.href} href={item.href} className="hover:text-zinc-900">
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
