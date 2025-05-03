import type {Metadata} from 'next';
import {Roboto} from 'next/font/google';
import './globals.css';
import {Toaster} from "@/components/ui/toaster";
import {SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger} from "@/components/ui/sidebar"; // Added SidebarTrigger
import {Home, BarChart2, Package, DollarSign, Archive} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
    <html lang="en" className={cn(roboto.className, "light")}>
      <body className="min-h-screen antialiased bg-background text-foreground">
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
                    {/* Wrap menu items in a component that closes the mobile sheet on click */}
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
              </Sidebar>
              {/* Main Content Area */}
              <main className="flex-1 overflow-auto">
                {/* Add SidebarTrigger for mobile */}
                <div className="sticky top-0 z-10 flex items-center justify-end p-2 bg-background/80 backdrop-blur-sm md:hidden border-b">
                    <SidebarTrigger />
                </div>
                {children}
              </main>
            </div>
             <Toaster/>
        </SidebarProvider>
      </body>
    </html>
  );
}

// Helper component to close sheet on mobile navigation
// const MobileAwareMenuItem = ({ children }: { children: React.ReactNode }) => {
//   const { isMobile, setOpenMobile } = useSidebar(); // Assuming useSidebar provides these

//   const handleClick = () => {
//     if (isMobile) {
//       setOpenMobile(false);
//     }
//   };

//   return <div onClickCapture={handleClick}>{children}</div>;
// };

// Example usage in layout (concept):
{/* <MobileAwareMenuItem>
  <Link href="/">
    <SidebarMenuButton>...</SidebarMenuButton>
  </Link>
</MobileAwareMenuItem> */}

// NOTE: Direct implementation of MobileAwareMenuItem might be tricky with how SidebarMenuButton
// handles clicks. For now, the sidebar will stay open on mobile after navigation.
// A more robust solution might involve context or state management lifting.
// The current change focuses on making the trigger visible and functional.
