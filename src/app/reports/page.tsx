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
            // Prefer the stored unit cost price if available
            if (purchasedProduct.costPrice && !isNaN(parseFloat(purchasedProduct.costPrice))) {
                return parseFloat(purchasedProduct.costPrice);
            }
            // Otherwise, calculate from total price paid and original quantity
            const originalQty = parseInt(purchasedProduct.originalQuantityPurchased || "0", 10);
            const totalPaidPrice = parseFloat(purchasedProduct.pricePaid || "0");
            const unitCost = originalQty > 0 ? totalPaidPrice / originalQty : 0;
            return isNaN(unitCost) ? 0 : unitCost;
        }
        console.warn(`Unit cost not found for product: ${productName}. Returning 0.`);
        return 0; // Return 0 if product not found in purchase history
    };


  // --- Calculation Logic ---
  const calculateTotals = (start: Date | null, end: Date | null) => {
    let periodSpent = 0; // Cost of goods sold within the period
    let periodProfit = 0;
    let periodRevenue = 0;

    // Calculate Total Spending (All Time) - based on the archive
    const allTimeSpent = allPurchasedProducts.reduce((acc: number, product: PurchasedProduct) => {
        const pricePaid = parseFloat(product.pricePaid || "0");
        return acc + (isNaN(pricePaid) ? 0 : pricePaid);
    }, 0);
    setTotalSpent(allTimeSpent);

    // Determine the date range for filtering sales
    let effectiveStartDate = start ? new Date(start) : new Date(0); // Beginning of time if no start date
    let effectiveEndDate = end ? new Date(end) : new Date(); // Now if no end date

    // Adjust dates for comparison (inclusive range)
    effectiveStartDate.setHours(0, 0, 0, 0);
    effectiveEndDate.setHours(23, 59, 59, 999); // Include the whole end day


     // Filter sales within the date range
     const salesInRange = salesData.filter((sale: SalesData) => {
         const saleDate = new Date(sale.dateOfSale); // Ensure it's a date object
         return saleDate >= effectiveStartDate && saleDate <= effectiveEndDate;
     });
     setFilteredSalesData(salesInRange); // Update the list of sales orders displayed


    // Calculate Revenue, Profit, and Spending (Cost of Goods Sold) based on *sales within the selected date range*
    salesInRange.forEach((sale: SalesData) => {
        sale.productsSold.forEach(soldProduct => {
            const salePrice = parseFloat(soldProduct.salePrice || "0");
            const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);

            if (isNaN(salePrice) || isNaN(quantitySold) || quantitySold <= 0) {
                 console.warn(`Invalid sale data found for product ${soldProduct.productName} in sale ${sale.id}. Skipping.`);
                 return; // Skip calculation for this item if data is invalid
            }

            const saleRevenueForItem = salePrice * quantitySold;
            periodRevenue += saleRevenueForItem;

            // Use helper to get unit cost
            const unitCostPrice = getUnitCost(soldProduct.productName);

            const costForThisSaleItem = unitCostPrice * quantitySold;
            periodSpent += costForThisSaleItem; // Add cost of this sold item to period spending
            periodProfit += (saleRevenueForItem - costForThisSaleItem); // Calculate profit for this item
        });
    });

    setTotalRevenue(periodRevenue);
    setTotalProfit(periodProfit);
    // Note: We set totalSpent (all-time) earlier. periodSpent is calculated but not displayed in a separate card.
  };

    // --- Event Handlers ---
    const handleDateChange = (setter: React.Dispatch<React.SetStateAction<Date | null>>) => (date: Date | undefined) => {
         setter(date || null); // Directly set the date or null
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
                 // Validate edited product details
                 for (const product of editProductsSold) {
                    if (isNaN(parseFloat(product.salePrice)) || parseFloat(product.salePrice) < 0 || isNaN(parseInt(product.quantitySold)) || parseInt(product.quantitySold) <= 0) {
                        toast({
                            title: "Invalid Input",
                            description: `Please ensure sale price and quantity are valid for ${product.productName}.`,
                            variant: "destructive",
                        });
                        return; // Prevent update if validation fails
                    }
                }
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
                    // Create a new entry for current inventory based on archive details + returned quantity
                     updatedInventory.push({
                       productName: archiveProduct.productName,
                       pricePaid: archiveProduct.pricePaid, // Use archive total price paid
                       quantity: qtySold.toString(), // Set quantity to what's being returned
                       originalQuantityPurchased: archiveProduct.originalQuantityPurchased, // Use archive original qty
                       costPrice: archiveProduct.costPrice, // Use archive cost price
                       productImage: archiveProduct.productImage, // Use archive image
                     });
                } else {
                     console.warn(`Cannot add back inventory for ${soldProduct.productName}: Original purchase details not found.`);
                     // Optionally, create a new placeholder entry if needed, though less ideal without cost info
                }
            }

            // Also add back to archived inventory quantity
            const purchIndex = updatedPurchasedProducts.findIndex(p => p.productName === soldProduct.productName);
            if (purchIndex !== -1) {
                const currentArchivedQty = parseInt(updatedPurchasedProducts[purchIndex].quantity, 10);
                // Ensure quantity doesn't exceed original purchased quantity if necessary, though generally adding back is fine
                updatedPurchasedProducts[purchIndex].quantity = (currentArchivedQty + qtySold).toString();
            }
             // If not found in archive, this indicates a data inconsistency, log warning?
             else {
                 console.warn(`Product ${soldProduct.productName} from removed sale not found in archive for quantity adjustment.`);
             }
        });


         // Filter out the sale to remove
         const updatedSalesData = salesData.filter(sale => sale.id !== saleId);

        try {
             localStorage.setItem("sales", JSON.stringify(updatedSalesData));
             localStorage.setItem("productDetails", JSON.stringify(updatedInventory)); // Save updated current inventory
             localStorage.setItem("purchasedProducts", JSON.stringify(updatedPurchasedProducts)); // Save updated archive

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
      <h1 className="page-title mb-10">Reports Dashboard</h1>

       {/* Date Filter Section */}
       <Card className="w-full max-w-4xl mb-10 shadow-md card"> {/* Use card class */}
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-lg">
             <CalendarDays className="h-5 w-5 text-primary" />
             Filter by Date Range
           </CardTitle>
         </CardHeader>
         <CardContent className="flex flex-col sm:flex-row items-center gap-4">
              {/* Start Date Popover */}
             <div className="flex-1 w-full sm:w-auto">
                 <Label htmlFor="start-date-btn" className="mb-1 block text-sm font-medium">Start Date</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="start-date-btn"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal input", // Use input class for style consistency
                          !startDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={startDate ?? undefined}
                        onSelect={handleDateChange(setStartDate)}
                        disabled={(date) => (endDate && date > endDate) || date > today} // Disable future dates and dates after end date
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
             </div>
             {/* End Date Popover */}
             <div className="flex-1 w-full sm:w-auto">
                 <Label htmlFor="end-date-btn" className="mb-1 block text-sm font-medium">End Date</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="end-date-btn"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal input", // Use input class
                          !endDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={endDate ?? undefined}
                        onSelect={handleDateChange(setEndDate)}
                        disabled={(date) => (startDate && date < startDate) || date > today} // Disable future dates and dates before start date
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
             </div>
             {/* Clear Button */}
              <Button onClick={clearDates} variant="outline" className="mt-4 sm:mt-6 btn">
                 <FilterX className="mr-2 h-4 w-4" /> Clear Dates
              </Button>
         </CardContent>
       </Card>

        {/* Key Metrics Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mb-10"> {/* Increased bottom margin */}
            {/* Total Spending Card */}
            <Card className="card shadow-md hover:shadow-lg transition-shadow duration-200"> {/* Use card class */}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spending (All Time)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Based on all archived purchases.</p>
            </CardContent>
            </Card>

            {/* Total Profit Card */}
            <Card className="card shadow-md hover:shadow-lg transition-shadow duration-200"> {/* Use card class */}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Profit (Period)</CardTitle>
                 <div className={cn("h-4 w-4", totalProfit >= 0 ? 'text-green-500' : 'text-red-500')}>
                    {totalProfit >= 0 ? <TrendingUp/> : <TrendingDown/>}
                 </div>
            </CardHeader>
            <CardContent>
                 <div className={cn("text-2xl font-bold", totalProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                     {totalProfit < 0 ? '-' : ''}${Math.abs(totalProfit).toFixed(2)}
                 </div>
                <p className="text-xs text-muted-foreground">Revenue - Cost of Goods Sold in period.</p>
            </CardContent>
            </Card>

            {/* Total Revenue Card */}
            <Card className="card shadow-md hover:shadow-lg transition-shadow duration-200"> {/* Use card class */}
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue (Period)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Total income from sales in period.</p>
            </CardContent>
            </Card>
        </div>

      {/* Sales Orders List Section */}
      <div className="w-full max-w-4xl p-0">
        <Card className="card shadow-md"> {/* Use card class */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
               <ListOrdered className="h-5 w-5 text-primary"/>
               Sales Orders {startDate || endDate ? '(Filtered)' : '(All Time)'}
            </CardTitle>
            <CardDescription>Sales within the selected period (most recent first).</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px] w-full border rounded-md p-1"> {/* Added padding */}
              {filteredSalesData.length > 0 ? (
                <ul className="divide-y divide-border">
                  {filteredSalesData.map((sale: SalesData) => {
                    let saleProfit = 0;
                    let saleRevenue = 0;
                    let saleCost = 0; // Cost of goods sold in this specific sale

                    sale.productsSold.forEach((soldProduct) => {
                        const salePrice = parseFloat(soldProduct.salePrice || "0");
                        const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);

                        if (isNaN(salePrice) || isNaN(quantitySold) || quantitySold <= 0) return; // Skip invalid

                        const itemRevenue = salePrice * quantitySold;
                        saleRevenue += itemRevenue;

                        const unitCostPrice = getUnitCost(soldProduct.productName);

                        const itemCost = unitCostPrice * quantitySold;
                        saleCost += itemCost;
                        saleProfit += (itemRevenue - itemCost);
                    });

                    return (
                      <li key={sale.id} className="p-4 hover:bg-accent/50 transition-colors group relative"> {/* Added relative */}
                        <div className="flex justify-between items-start mb-3"> {/* Increased margin */}
                            <div>
                                <p className="font-semibold text-base">
                                Sale Date: {format(sale.dateOfSale, "PPP")} {/* Formatted Date */}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">ID: {sale.id}</p>
                            </div>
                             {/* Sale Summary */}
                             <div className="text-right text-xs space-y-1 flex-shrink-0 ml-4 bg-muted/40 px-3 py-2 rounded-md border subtle-border">
                                <div>Revenue: <span className="font-medium">${saleRevenue.toFixed(2)}</span></div>
                                <div>Cost: <span className="font-medium">${saleCost.toFixed(2)}</span></div>
                                <div className={cn("font-semibold", saleProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                                    Profit: {saleProfit < 0 ? '-' : ''}${Math.abs(saleProfit).toFixed(2)}
                                </div>
                            </div>
                        </div>
                        {/* Products Sold Details */}
                        <div className="text-sm space-y-1.5"> {/* Increased spacing */}
                           <p className="font-medium text-foreground">Products Sold:</p>
                            <ul className="list-disc list-inside pl-2 space-y-1 text-muted-foreground"> {/* Added spacing */}
                                {sale.productsSold.map((soldProduct, i) => (
                                <li key={i}>
                                    {soldProduct.productName} ({soldProduct.quantitySold} x ${parseFloat(soldProduct.salePrice).toFixed(2)})
                                </li>
                                ))}
                            </ul>
                        </div>
                         {/* Edit/Remove Buttons - Appear on hover */}
                          <div className="absolute top-3 right-3 flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                             <Button onClick={() => handleEditSale(sale.id)} variant="outline" size="icon" className="btn h-7 w-7">
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit Sale</span>
                             </Button>
                             <Button onClick={() => setOpenRemoveDialog(sale.id)} variant="destructive" size="icon" className="btn h-7 w-7">
                                <Trash2 className="h-4 w-4" />
                                 <span className="sr-only">Remove Sale</span>
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
                             {/* Product Name (Read-only) */}
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
                <Button type="button" variant="secondary" onClick={() => setOpenEditDialog(false)} className="btn">Cancel</Button>
                <Button type="button" onClick={handleUpdateSale} className="btn-primary btn">Save Changes</Button>
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
             <Button variant="outline" onClick={() => setOpenRemoveDialog(null)} className="btn">
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
