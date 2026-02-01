import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ['400', '500', '600', '700']
});

export const metadata: Metadata = {
  title: "Private Reader",
  description: "Clean reader without ads",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFDF8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0f' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${lora.variable} antialiased bg-[#F5F5F4]`}>
        {children}
      </body>
    </html>
  );
}