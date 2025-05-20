"use client"; // Add this directive

import './globals.css' // Make sure global styles are imported
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import Navigation from '@/components/navigation'
import { Toaster } from '@/components/ui/sonner'
import { usePathname } from 'next/navigation';

const inter = Inter({ subsets: ['latin'] })

// export const metadata: Metadata = {
//   title: 'Micro-Expression Analysis',
//   description: 'Advanced facial micro-expression analysis platform',
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname(); // Get the current pathname
  const isDatasetPage = pathname === '/dataset';

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        // className={
        //   process.env.HIDE_NEXT_ERROR_OVERLAY === "true"
        //     ? `hide-nextjs-portal ${inter.className}`
        //     : inter.className
        // }
        className={`hide-nextjs-portal ${inter.className}`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="flex flex-col h-screen">
            <Navigation />
            <main className="flex-1 overflow-auto bg-white dark:bg-[#191919]">
              {children}
            </main>
          </div>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}