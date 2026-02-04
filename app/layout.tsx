import type { Metadata, Viewport } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  weight: ['400', '500', '600', '700']
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFDF8' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0f' },
  ],
};

export const metadata: Metadata = {
  title: "Private Reader",
  description: "Clean reader without ads",
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.ico', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/favicon.ico', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
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