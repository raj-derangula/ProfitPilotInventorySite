"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose} from "@/components/ui/dialog";
import {useToast} from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, DollarSign, ListOrdered, CalendarDays, FilterX, Edit, Trash2, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ProductDetails { // Represents current inventory items
  productName: string;
  pricePaid: string; // Total price for original quantity
  quantity: string; // Current stock
  originalQuantityPurchased: string;
  costPrice?: string; // Unit cost
  productImage?: string;
}

interface SalesOrderItem {
    productName: string;
    salePrice: string; // Unit sale price
    quantitySold: string;
}

interface SalesData { // Represents a single sale transaction
  id: string; // Unique ID for each sale
  productsSold: SalesOrderItem[];
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
  const [salesData, setSalesData] = useState<SalesData[]>([]); // All sales loaded once
  const [filteredSalesData, setFilteredSalesData] = useState<SalesData[]>([]); // Sales within date range
  const [allPurchasedProducts, setAllPurchasedProducts] = useState<PurchasedProduct[]>([]); // Archive loaded once
  const [inventory, setInventory] = useState<ProductDetails[]>([]); // Current inventory loaded once for edit/remove logic
  const {toast} = useToast();

  // State for Edit/Remove Dialogs
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openRemoveDialog, setOpenRemoveDialog] = useState<string | null>(null); // Store ID of sale to remove
  const [selectedSale, setSelectedSale] = useState<SalesData | null>(null); // Store the full sale object being edited
  const [editDateOfSale, setEditDateOfSale] = useState<Date | undefined>(undefined);
  const [editProductsSold, setEditProductsSold] = useState<SalesOrderItem[]>([]);

  const today = new Date();

  // --- Data Loading ---
  useEffect(() => {
     // Function to safely parse JSON from local storage
     const safelyParseJSON = (key: string, defaultValue: any = []) => {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
            try {
                const parsed = JSON.parse(storedValue);
                 // Ensure it's an array before returning
                if (Array.isArray(parsed)) {
                     // Add deeper validation if needed
                    return parsed;
                }
                console.warn(`Data for key "${key}" is not an array, clearing.`);
            } catch (e) {
                console.error(`Error parsing JSON from localStorage key "${key}":`, e);
            }
             // Clear invalid data if parsing failed or wasn't an array
            localStorage.removeItem(key);
        }
        return defaultValue; // Return default value if not found or invalid
     };

     // Load all necessary data on mount
    const loadedSales = safelyParseJSON("sales").map((sale: any) => ({
        ...sale,
        id: sale.id || `sale_${Date.now()}_${Math.random()}`, // Assign ID if missing (for older data)
        dateOfSale: new Date(sale.dateOfSale) // Ensure date is a Date object
    }));
    loadedSales.sort((a: SalesData, b: SalesData) => b.dateOfSale.getTime() - a.dateOfSale.getTime());
    setSalesData(loadedSales);

    setAllPurchasedProducts(safelyParseJSON("purchasedProducts"));
    setInventory(safelyParseJSON("productDetails"));

  }, []); // Empty dependency array ensures this runs only once on mount

    // --- Recalculations ---
  useEffect(() => {
    // Recalculate whenever dates or the base data changes
    calculateTotals(startDate, endDate);
  }, [salesData, allPurchasedProducts, startDate, endDate]); // Recalculate when dates change or data loads

  // --- Helper Functions ---
  const getUnitCost = (productName: string): number => {
        const purchasedProduct = allPurchasedProducts.find((p: PurchasedProduct) => p.productName === productName);
        if (purchasedProduct) {
            const originalQty = parseInt(purchasedProduct.originalQuantityPurchased || "0", 10);
            const totalPaidPrice = parseFloat(purchasedProduct.pricePaid || "0");
            const unitCost = purchasedProduct.costPrice ? parseFloat(purchasedProduct.costPrice) : (originalQty > 0 ? totalPaidPrice / originalQty : 0);
            return isNaN(unitCost) ? 0 : unitCost;
        }
        return 0; // Return 0 if product not found in purchase history
    };


  // --- Calculation Logic ---
  const calculateTotals = (start: Date | null, end: Date | null) => {
    let currentSpent = 0;
    let currentProfit = 0;
    let currentRevenue = 0;

    // Determine the date range for filtering sales
    let effectiveStartDate = start ? new Date(start) : new Date(0); // Beginning of time if no start date
    let effectiveEndDate = end ? new Date(end) : new Date(); // Now if no end date

    // Adjust dates for comparison
    effectiveStartDate.setHours(0, 0, 0, 0);
    if (end) {
        effectiveEndDate.setHours(23, 59, 59, 999); // Include the whole end day
    } else {
        effectiveEndDate.setHours(23, 59, 59, 999); // Use today if no end date
    }


     // Filter sales within the date range
     const salesInRange = salesData.filter((sale: SalesData) => {
         const saleDate = new Date(sale.dateOfSale); // Ensure it's a date object
         return saleDate >= effectiveStartDate && saleDate <= effectiveEndDate;
     });
     setFilteredSalesData(salesInRange); // Update the list of sales orders displayed

     // Calculate Total Spending based on *all* purchased products (archive)
     // This represents the total investment recorded.
     currentSpent = allPurchasedProducts.reduce((acc: number, product: PurchasedProduct) => {
         const pricePaid = parseFloat(product.pricePaid || "0");
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

             // Use helper to get unit cost
            const unitCostPrice = getUnitCost(soldProduct.productName);

            if (unitCostPrice > 0) {
                const costForThisSale = unitCostPrice * quantitySold;
                currentProfit += (saleRevenueForItem - costForThisSale);
            } else {
                // If cost is 0 or product not found, revenue is the profit for this item
                currentProfit += saleRevenueForItem;
                console.warn(`Cost not found or zero for ${soldProduct.productName} in sale ${sale.id}. Profit calculation might be less accurate.`);
            }
        });
    });

    setTotalRevenue(currentRevenue);
    setTotalProfit(currentProfit);
  };

    // --- Event Handlers ---
    const handleDateChange = (setter: React.Dispatch<React.SetStateAction<Date | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            // Ensure the date is parsed correctly, considering timezone might shift the date
            const [year, month, day] = e.target.value.split('-').map(Number);
            setter(new Date(year, month - 1, day)); // Use Date constructor with year, month (0-indexed), day
        } else {
            setter(null); // Reset to null if input is cleared
        }
    };

    const clearDates = () => {
      setStartDate(null);
      setEndDate(null);
    };

    // --- Edit Sale ---
    const handleEditSale = (saleId: string) => {
        const saleToEdit = salesData.find(sale => sale.id === saleId);
        if (saleToEdit) {
            setSelectedSale(saleToEdit);
            setEditDateOfSale(new Date(saleToEdit.dateOfSale)); // Ensure it's a new Date object
            // Deep copy productsSold to avoid direct state mutation
            setEditProductsSold(saleToEdit.productsSold.map(p => ({ ...p })));
            setOpenEditDialog(true);
        }
    };

    // Placeholder for update logic - Complex inventory adjustment needed
    const handleUpdateSale = () => {
        if (!selectedSale || !editDateOfSale) return;

        // --- Complex Validation & Inventory Adjustment Needed Here ---
        // 1. Compare `selectedSale.productsSold` with `editProductsSold`.
        // 2. Calculate the *difference* in quantity for each product.
        // 3. Check if inventory allows for increases in sold quantity.
        // 4. Adjust `inventory` state/localStorage by adding back/removing the difference.
        // 5. Adjust `allPurchasedProducts` state/localStorage similarly if its quantity tracks current stock.

        // For now, just update the sale data itself
        const updatedSalesData = salesData.map(sale => {
            if (sale.id === selectedSale.id) {
                return {
                    ...sale,
                    dateOfSale: editDateOfSale,
                    productsSold: editProductsSold,
                };
            }
            return sale;
        });

        // Sort again after potential date change
        updatedSalesData.sort((a, b) => new Date(b.dateOfSale).getTime() - new Date(a.dateOfSale).getTime());


        try {
            localStorage.setItem("sales", JSON.stringify(updatedSalesData));
            // TODO: Save updated inventory and purchasedProducts if adjusted
            setSalesData(updatedSalesData);
            setOpenEditDialog(false);
            setSelectedSale(null); // Clear selected sale
            toast({
                title: "✅ Sale Updated (Basic)",
                description: `Sale ID ${selectedSale.id} details saved. (Inventory not adjusted yet)`,
            });
        } catch (error) {
             console.error("Error saving updated sale:", error);
             toast({
                title: "Storage Error",
                description: "Failed to save updated sale.",
                variant: "destructive",
             });
        }
    };

    // --- Remove Sale ---
    const handleRemoveSale = (saleId: string) => {
        const saleToRemove = salesData.find(sale => sale.id === saleId);
        if (!saleToRemove) return;

        let updatedInventory = [...inventory];
        let updatedPurchasedProducts = [...allPurchasedProducts];

        // --- Add quantities back to inventory ---
        saleToRemove.productsSold.forEach(soldProduct => {
            const qtySold = parseInt(soldProduct.quantitySold, 10);
            if (isNaN(qtySold) || qtySold <= 0) return; // Skip invalid data

            // Add back to current inventory
            const invIndex = updatedInventory.findIndex(p => p.productName === soldProduct.productName);
            if (invIndex !== -1) {
                const currentQty = parseInt(updatedInventory[invIndex].quantity, 10);
                updatedInventory[invIndex].quantity = (currentQty + qtySold).toString();
            } else {
                // If not in current inventory (was sold out), try to find in archive to add it back
                const archiveProduct = allPurchasedProducts.find(p => p.productName === soldProduct.productName);
                if (archiveProduct) {
                    updatedInventory.push({
                        ...archiveProduct, // Use archive details
                        quantity: qtySold.toString(), // Set quantity to what's being returned
                    });
                } else {
                     console.warn(`Cannot add back inventory for ${soldProduct.productName}: Original purchase details not found.`);
                }
            }

            // Add back to archived inventory quantity (if it tracks current stock)
            const purchIndex = updatedPurchasedProducts.findIndex(p => p.productName === soldProduct.productName);
            if (purchIndex !== -1) {
                const currentArchivedQty = parseInt(updatedPurchasedProducts[purchIndex].quantity, 10);
                updatedPurchasedProducts[purchIndex].quantity = (currentArchivedQty + qtySold).toString();
            }
        });


         // Filter out the sale to remove
         const updatedSalesData = salesData.filter(sale => sale.id !== saleId);

        try {
             localStorage.setItem("sales", JSON.stringify(updatedSalesData));
             localStorage.setItem("productDetails", JSON.stringify(updatedInventory));
             localStorage.setItem("purchasedProducts", JSON.stringify(updatedPurchasedProducts));

             setSalesData(updatedSalesData);
             setInventory(updatedInventory);
             setAllPurchasedProducts(updatedPurchasedProducts);

             setOpenRemoveDialog(null); // Close confirmation dialog
             toast({
                title: "🗑️ Sale Removed",
                description: `Sale ID ${saleId} has been removed and inventory adjusted.`,
                variant: "destructive",
             });
        } catch (error) {
             console.error("Error removing sale:", error);
             toast({
                title: "Storage Error",
                description: "Failed to remove sale data or update inventory.",
                variant: "destructive",
             });
        }
    };


    // --- Render ---
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
                value={startDate ? format(startDate, 'yyyy-MM-dd') : ''} // Format for input
                onChange={handleDateChange(setStartDate)}
                className="input"
             />
             </div>
             <div className="flex-1 w-full sm:w-auto">
             <Label htmlFor="end-date" className="mb-1 block text-sm font-medium">End Date</Label>
             <Input
                type="date"
                id="end-date"
                value={endDate ? format(endDate, 'yyyy-MM-dd') : ''} // Format for input
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
                  {filteredSalesData.map((sale: SalesData) => {
                    let saleProfit = 0;
                    let saleRevenue = 0;
                    let saleSpending = 0; // Cost of goods sold in this specific sale

                    sale.productsSold.forEach((soldProduct) => {
                        const salePrice = parseFloat(soldProduct.salePrice || "0");
                        const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);
                        const itemRevenue = salePrice * quantitySold;
                        saleRevenue += itemRevenue;

                        const unitCostPrice = getUnitCost(soldProduct.productName);

                        if (unitCostPrice >= 0) { // Check if cost is non-negative
                            const itemCost = unitCostPrice * quantitySold;
                            saleSpending += itemCost;
                            saleProfit += (itemRevenue - itemCost);
                        } else {
                            saleProfit += itemRevenue; // If cost negative or not found, treat revenue as profit for item
                        }
                    });

                    return (
                      <li key={sale.id} className="p-4 hover:bg-accent/50 transition-colors group">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="font-semibold text-base">
                                Sale Date: {sale.dateOfSale.toLocaleDateString()}
                                </p>
                                <p className="text-xs text-muted-foreground">ID: {sale.id}</p>
                            </div>
                             <div className="text-right text-xs space-y-1 flex-shrink-0 ml-4">
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
                         {/* Edit/Remove Buttons */}
                          <div className="mt-3 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                             <Button onClick={() => handleEditSale(sale.id)} variant="outline" size="sm" className="btn">
                                <Edit className="h-4 w-4" />
                             </Button>
                             <Button onClick={() => setOpenRemoveDialog(sale.id)} variant="destructive" size="sm" className="btn">
                                <Trash2 className="h-4 w-4" />
                             </Button>
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

        {/* Edit Sale Dialog */}
        <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
            <DialogContent className="sm:max-w-[600px]"> {/* Wider dialog */}
            <DialogHeader>
                <DialogTitle>Edit Sale Order (ID: {selectedSale?.id})</DialogTitle>
                <DialogDescription>Modify the details of this sale. Inventory adjustments are complex and not fully implemented in this edit.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4"> {/* Scrollable content */}
                 {/* Date Picker */}
                 <div className="grid grid-cols-4 items-center gap-4">
                     <Label htmlFor="edit-sale-date" className="text-right">Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={"outline"}
                            id="edit-sale-date"
                            className={cn(
                              "col-span-3 justify-start text-left font-normal input",
                              !editDateOfSale && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editDateOfSale ? format(editDateOfSale, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={editDateOfSale}
                            onSelect={setEditDateOfSale}
                            disabled={(date) => date > today || date < new Date("2000-01-01")}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                 </div>

                {/* Products Sold List */}
                {editProductsSold.map((product, index) => (
                    <div key={`edit-${index}`} className="grid grid-cols-4 items-start gap-4 border-b pb-4">
                         <Label className="text-right pt-2 col-span-1">Item {index + 1}</Label>
                         <div className="col-span-3 grid gap-2">
                             {/* Product Name (Consider if this should be editable - might break links) */}
                             <Input value={product.productName} readOnly className="input bg-muted" title="Product name cannot be changed here"/>

                             {/* Quantity Sold */}
                              <div className="grid grid-cols-4 items-center gap-4">
                                 <Label htmlFor={`edit-qty-${index}`} className="text-right text-xs">Qty</Label>
                                 <Input
                                    id={`edit-qty-${index}`}
                                    type="number"
                                    value={product.quantitySold}
                                    onChange={(e) => {
                                        const updated = [...editProductsSold];
                                        updated[index].quantitySold = e.target.value;
                                        setEditProductsSold(updated);
                                    }}
                                    className="col-span-3 input"
                                    min="1"
                                />
                              </div>

                              {/* Sale Price */}
                               <div className="grid grid-cols-4 items-center gap-4">
                                 <Label htmlFor={`edit-price-${index}`} className="text-right text-xs">Price</Label>
                                 <div className="relative col-span-3">
                                     <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                     <Input
                                        id={`edit-price-${index}`}
                                        type="number"
                                        value={product.salePrice}
                                        onChange={(e) => {
                                            const updated = [...editProductsSold];
                                            updated[index].salePrice = e.target.value;
                                            setEditProductsSold(updated);
                                        }}
                                        className="pl-8 input"
                                        step="0.01" min="0"
                                    />
                                </div>
                               </div>
                         </div>
                         {/* Consider adding remove item button here if needed */}
                    </div>
                ))}
                 {/* Consider adding 'Add Item' button here if needed */}

            </div>
            <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpenEditDialog(false)}>Cancel</Button>
                <Button type="button" onClick={handleUpdateSale} className="btn-primary">Save Changes</Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>


       {/* Remove Confirmation Dialog */}
       <Dialog open={openRemoveDialog !== null} onOpenChange={() => setOpenRemoveDialog(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Confirm Sale Removal</DialogTitle>
             <DialogDescription>
               Are you sure you want to remove sale order <span className="font-bold">{openRemoveDialog}</span>? This action cannot be undone and will add the sold items back to your inventory counts.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={() => setOpenRemoveDialog(null)}>
               Cancel
             </Button>
             <Button variant="destructive" onClick={() => handleRemoveSale(openRemoveDialog!)} className="btn">
               Confirm Removal
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

    </div>
  );
}
