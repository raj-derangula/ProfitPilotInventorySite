import type {Metadata} from 'next';
import {Roboto} from 'next/font/google';
import './globals.css';
import {Toaster} from "@/components/ui/toaster";
import {SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton} from "@/components/ui/sidebar";
import {Home, BarChart2, Package, DollarSign, Archive} from "lucide-react"; // Use Package instead of PackagePlus
import Link from "next/link";
import { cn } from "@/lib/utils"; // Import cn

const roboto = Roboto({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ProfitPilot',
  description: 'Track your profits effortlessly.', // Improved description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn(roboto.className, "light")}> {/* Default to light mode */}
      <body className="min-h-screen antialiased bg-background text-foreground"> {/* Apply bg/text here */}
        <SidebarProvider>
          {/* Sidebar Wrapper for Flex Layout */}
          <div data-sidebar-wrapper>
              <Sidebar>
                <SidebarContent>
                   <div className="p-4 text-center border-b border-sidebar-border">
                      <Link href="/" className="flex items-center justify-center gap-2 group">
                          {/* You can replace this with an actual logo SVG or Image */}
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
                           <Package/> {/* Changed icon */}
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
              </Sidebar>
              {/* Main Content Area */}
              <main className="flex-1 overflow-auto"> {/* Added overflow-auto */}
                {children}
              </main>
            </div>
             <Toaster/> {/* Place Toaster outside the flex container if needed */}
        </SidebarProvider>
      </body>
    </html>
  );
}
