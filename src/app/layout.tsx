import type {Metadata} from 'next';
import {Roboto} from 'next/font/google';
import './globals.css';
import {Toaster} from "@/components/ui/toaster";
import {SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger, SidebarFooter} from "@/components/ui/sidebar";
import {Home, BarChart2, Package, DollarSign, Archive} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import Script from "next/script";

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ProfitPilot',
  description: 'Track your profits effortlessly.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(roboto.className)} suppressHydrationWarning>
      <body className="min-h-screen antialiased bg-background text-foreground">
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.add('light')}}catch(e){}})()`,
          }}
        />
        <ThemeProvider>
          <SidebarProvider>
            <div data-sidebar-wrapper>
                <Sidebar>
                  <SidebarContent>
                     <div className="p-4 text-center border-b border-sidebar-border">
                        <Link href="/" className="flex items-center justify-center gap-2 group">
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-primary transition-transform duration-300 group-hover:rotate-[15deg]">
                                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                             </svg>
                            <span className="text-xl font-bold text-foreground">ProfitPilot</span>
                        </Link>
                     </div>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <Link href="/">
                          <SidebarMenuButton>
                            <Home/>
                            <span>Add Product</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/inventory">
                           <SidebarMenuButton>
                             <Package/>
                             <span>Inventory</span>
                           </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/sell">
                           <SidebarMenuButton>
                             <DollarSign/>
                             <span>Sell</span>
                           </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <Link href="/reports">
                          <SidebarMenuButton>
                            <BarChart2/>
                            <span>Reports</span>
                          </SidebarMenuButton>
                        </Link>
                      </SidebarMenuItem>
                        <SidebarMenuItem>
                            <Link href="/archived-inventory">
                                <SidebarMenuButton>
                                  <Archive/>
                                  <span>Archived Inventory</span>
                                </SidebarMenuButton>
                            </Link>
                        </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarContent>
                  <SidebarFooter className="border-t border-sidebar-border p-2">
                    <ThemeToggle />
                  </SidebarFooter>
                </Sidebar>
                {/* Main Content Area */}
                <main className="flex-1 overflow-auto min-w-0">
                  {/* Mobile top bar with sidebar trigger */}
                  <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-background/90 backdrop-blur-sm md:hidden border-b border-border">
                    <Link href="/" className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>
                      </svg>
                      <span className="text-base font-bold text-foreground">ProfitPilot</span>
                    </Link>
                    <SidebarTrigger />
                  </div>
                  {children}
                </main>
              </div>
               <Toaster/>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
