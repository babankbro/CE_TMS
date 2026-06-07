import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="th" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
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
