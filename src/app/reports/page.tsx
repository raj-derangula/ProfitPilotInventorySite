"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Button} from "@/components/ui/button"; // Import Button
import { TrendingUp, TrendingDown, DollarSign, ListOrdered, CalendarDays, FilterX } from "lucide-react"; // Added icons

interface ProductDetails { // Represents current inventory items
  productName: string;
  pricePaid: string; // Total price for original quantity
  quantity: string; // Current stock
  originalQuantityPurchased: string;
  costPrice?: string; // Unit cost
  productImage?: string;
}

interface SalesData { // Represents a single sale transaction
  productsSold: {
    productName: string;
    salePrice: string; // Unit sale price
    quantitySold: string;
  }[];
  dateOfSale: Date; // Should be stored as ISO string, parsed to Date
}

interface PurchasedProduct { // Represents an item entry in the archive
  productName: string;
  pricePaid: string; // Total price paid for original quantity
  quantity: string; // Final quantity (can be 0)
  originalQuantityPurchased: string;
  costPrice?: string; // Unit cost
  productImage?: string;
}

export default function Reports() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  // const [productDetails, setProductDetails] = useState<ProductDetails[]>([]); // Current inventory (may not be needed here directly)
  const [salesData, setSalesData] = useState<SalesData[]>([]); // All sales loaded once
  const [filteredSalesData, setFilteredSalesData] = useState<SalesData[]>([]); // Sales within date range
  const [allPurchasedProducts, setAllPurchasedProducts] = useState<PurchasedProduct[]>([]); // Archive loaded once

    useEffect(() => {
        // Load all necessary data on mount
        const storedSales = localStorage.getItem("sales");
        if (storedSales) {
            try {
                const parsedSales = JSON.parse(storedSales).map((sale: any) => ({
                    ...sale,
                    dateOfSale: new Date(sale.dateOfSale) // Ensure date is a Date object
                }));
                // Sort sales data by date descending (most recent first)
                parsedSales.sort((a: SalesData, b: SalesData) => b.dateOfSale.getTime() - a.dateOfSale.getTime());
                setSalesData(parsedSales);
            } catch (e) {
                console.error("Failed to parse sales data:", e);
                localStorage.removeItem("sales");
            }
        }

        const storedPurchasedProducts = localStorage.getItem("purchasedProducts");
        if (storedPurchasedProducts) {
             try {
                const parsedPurchased = JSON.parse(storedPurchasedProducts);
                if (Array.isArray(parsedPurchased)) {
                    setAllPurchasedProducts(parsedPurchased);
                } else {
                     localStorage.removeItem("purchasedProducts");
                }
             } catch(e) {
                  console.error("Failed to parse purchased products:", e);
                  localStorage.removeItem("purchasedProducts");
             }
        }
    }, []); // Empty dependency array ensures this runs only once on mount

    useEffect(() => {
        // Recalculate whenever dates or the base data changes
        calculateTotals(startDate, endDate);
    }, [salesData, allPurchasedProducts, startDate, endDate]); // Recalculate when dates change or data loads


  const calculateTotals = (start: Date | null, end: Date | null) => {
    let currentSpent = 0;
    let currentProfit = 0;
    let currentRevenue = 0;

    // Determine the date range for filtering sales and purchases
    let effectiveStartDate = start ? new Date(start) : new Date(0); // Beginning of time if no start date
     let effectiveEndDate = end ? new Date(end) : new Date(); // Now if no end date

     // Adjust end date to include the whole day
     if (end) {
       effectiveEndDate.setHours(23, 59, 59, 999);
     }

     // Filter sales within the date range
     const salesInRange = salesData.filter((sale: SalesData) => {
         return sale.dateOfSale >= effectiveStartDate && sale.dateOfSale <= effectiveEndDate;
     });
     setFilteredSalesData(salesInRange); // Update the list of sales orders displayed

     // Calculate Total Spending based on *all* purchased products (archive)
     // This represents the total investment recorded.
     currentSpent = allPurchasedProducts.reduce((acc: number, product: PurchasedProduct) => {
         const pricePaid = parseFloat(product.pricePaid || "0");
         // Spending is based on the total price paid for the original quantity
         return acc + pricePaid;
     }, 0);
     setTotalSpent(currentSpent); // Display total historical spending

    // Calculate Revenue and Profit based on *sales within the selected date range*
    salesInRange.forEach((sale: SalesData) => {
        sale.productsSold.forEach(soldProduct => {
            const salePrice = parseFloat(soldProduct.salePrice || "0");
            const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);
            const saleRevenueForItem = salePrice * quantitySold;
            currentRevenue += saleRevenueForItem;

            // Find the original purchase details for cost calculation
            // IMPORTANT: This assumes productName is unique enough or you implement a more robust lookup (e.g., by SKU/ID if added later)
            const purchasedProduct = allPurchasedProducts.find((p: PurchasedProduct) => p.productName === soldProduct.productName);

            if (purchasedProduct) {
                 const originalQty = parseInt(purchasedProduct.originalQuantityPurchased || "0", 10);
                 const totalPaidPrice = parseFloat(purchasedProduct.pricePaid || "0");
                 const unitCostPrice = purchasedProduct.costPrice ? parseFloat(purchasedProduct.costPrice) : (originalQty > 0 ? totalPaidPrice / originalQty : 0); // Use specific cost price if available, else calculate average

                 if (!isNaN(unitCostPrice)) {
                    const costForThisSale = unitCostPrice * quantitySold;
                    currentProfit += (saleRevenueForItem - costForThisSale);
                } else {
                     console.warn(`Could not determine cost for ${soldProduct.productName}. Profit calculation might be inaccurate.`);
                     currentProfit += saleRevenueForItem; // If cost unknown, count full revenue as profit (or handle differently)
                }
            } else {
                console.warn(`Original purchase details not found for sold item: ${soldProduct.productName}. Profit calculation might be inaccurate.`);
                currentProfit += saleRevenueForItem; // Treat as full profit if original purchase missing
            }
        });
    });

    setTotalRevenue(currentRevenue);
    setTotalProfit(currentProfit);
  };

    const handleDateChange = (setter: React.Dispatch<React.SetStateAction<Date | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            setter(new Date(e.target.value));
        } else {
            setter(null); // Reset to null if input is cleared
        }
    };

    const clearDates = () => {
      setStartDate(null);
      setEndDate(null);
    };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10 px-4">
      <h1 className="page-title mb-6">Reports Dashboard</h1>

       {/* Date Filter Section */}
       <Card className="w-full max-w-4xl mb-8 shadow-md">
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-lg">
             <CalendarDays className="h-5 w-5 text-primary" />
             Filter by Date Range
           </CardTitle>
         </CardHeader>
         <CardContent className="flex flex-col sm:flex-row items-center gap-4">
             <div className="flex-1 w-full sm:w-auto">
             <Label htmlFor="start-date" className="mb-1 block text-sm font-medium">Start Date</Label>
             <Input
                type="date"
                id="start-date"
                value={startDate ? startDate.toISOString().split('T')[0] : ''}
                onChange={handleDateChange(setStartDate)}
                className="input"
             />
             </div>
             <div className="flex-1 w-full sm:w-auto">
             <Label htmlFor="end-date" className="mb-1 block text-sm font-medium">End Date</Label>
             <Input
                type="date"
                id="end-date"
                value={endDate ? endDate.toISOString().split('T')[0] : ''}
                onChange={handleDateChange(setEndDate)}
                className="input"
             />
             </div>
              <Button onClick={clearDates} variant="outline" className="mt-4 sm:mt-6 btn">
                 <FilterX className="mr-2 h-4 w-4" /> Clear Dates
              </Button>
         </CardContent>
       </Card>

        {/* Key Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-8">
            {/* Total Spending Card */}
            <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spending (All Time)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Total amount spent on all purchased products.</p>
            </CardContent>
            </Card>

            {/* Total Profit Card */}
            <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Profit (Selected Period)</CardTitle>
                 <TrendingUp className={`h-4 w-4 ${totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
            </CardHeader>
            <CardContent>
                 <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>${totalProfit.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Profit from sales within the date range.</p>
            </CardContent>
            </Card>

            {/* Total Revenue Card */}
            <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue (Selected Period)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Revenue from sales within the date range.</p>
            </CardContent>
            </Card>
        </div>

      {/* Sales Orders List Section */}
      <div className="w-full max-w-4xl p-0"> {/* Removed padding to align with cards */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
               <ListOrdered className="h-5 w-5 text-primary"/>
               Sales Orders
            </CardTitle>
            <CardDescription>Sales orders within the selected time period (most recent first).</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] w-full border rounded-md">
              {filteredSalesData.length > 0 ? (
                <ul className="divide-y divide-border">
                  {filteredSalesData.map((sale: SalesData, index: number) => {
                    let saleProfit = 0;
                    let saleRevenue = 0;
                    let saleSpending = 0; // Cost of goods sold in this specific sale

                    sale.productsSold.forEach((soldProduct) => {
                        const salePrice = parseFloat(soldProduct.salePrice || "0");
                        const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);
                        const itemRevenue = salePrice * quantitySold;
                        saleRevenue += itemRevenue;

                        const purchasedProduct = allPurchasedProducts.find((p: PurchasedProduct) => p.productName === soldProduct.productName);
                        if (purchasedProduct) {
                            const originalQty = parseInt(purchasedProduct.originalQuantityPurchased || "0", 10);
                            const totalPaidPrice = parseFloat(purchasedProduct.pricePaid || "0");
                             const unitCostPrice = purchasedProduct.costPrice ? parseFloat(purchasedProduct.costPrice) : (originalQty > 0 ? totalPaidPrice / originalQty : 0);

                            if (!isNaN(unitCostPrice)) {
                                const itemCost = unitCostPrice * quantitySold;
                                saleSpending += itemCost;
                                saleProfit += (itemRevenue - itemCost);
                            } else {
                                 saleProfit += itemRevenue; // Or handle as error
                            }
                        } else {
                             saleProfit += itemRevenue; // Or handle as error
                        }
                    });

                    return (
                      <li key={index} className="p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <p className="font-semibold text-base">
                            Sale Date: {sale.dateOfSale.toLocaleDateString()}
                            </p>
                             <div className="text-right text-xs space-y-1">
                                <div>Revenue: <span className="font-medium">${saleRevenue.toFixed(2)}</span></div>
                                <div>Cost: <span className="font-medium">${saleSpending.toFixed(2)}</span></div>
                                <div className={`font-semibold ${saleProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Profit: ${saleProfit.toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div className="text-sm space-y-1">
                           <p className="font-medium">Products Sold:</p>
                            <ul className="list-disc list-inside pl-2 text-muted-foreground">
                                {sale.productsSold.map((soldProduct, i) => (
                                <li key={i}>
                                    {soldProduct.productName} ({soldProduct.quantitySold} x ${parseFloat(soldProduct.salePrice).toFixed(2)})
                                </li>
                                ))}
                            </ul>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                 <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <ListOrdered className="h-10 w-10 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No sales orders found for the selected time period.</p>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting the date filters or record a new sale.</p>
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}