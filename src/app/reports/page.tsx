"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {ScrollArea} from "@/components/ui/scroll-area";
import {Button} from "@/components/ui/button";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter} from "@/components/ui/dialog";
import {useToast} from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, DollarSign, ListOrdered, CalendarDays, FilterX, Edit, Trash2, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, startOfDay, endOfDay } from "date-fns";
import {
  type InventoryItem,
  type SaleRecord,
  type SalesOrderItem,
  getInventory,
  setInventory,
  getArchive,
  setArchive,
  getSales,
  setSales,
  putSale,
  deleteSale,
  initDB,
} from "@/lib/db";

export default function Reports() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [salesData, setSalesData] = useState<SaleRecord[]>([]);
  const [filteredSalesData, setFilteredSalesData] = useState<SaleRecord[]>([]);
  const [allPurchasedProducts, setAllPurchasedProducts] = useState<InventoryItem[]>([]);
  const [inventory, setInventoryState] = useState<InventoryItem[]>([]);
  const {toast} = useToast();

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openRemoveDialog, setOpenRemoveDialog] = useState<string | null>(null);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [editDateOfSale, setEditDateOfSale] = useState<Date | undefined>(undefined);
  const [editProductsSold, setEditProductsSold] = useState<SalesOrderItem[]>([]);

  const today = new Date();

  useEffect(() => {
    (async () => {
      await initDB();
      const [loadedSales, archive, inv] = await Promise.all([
        getSales(),
        getArchive(),
        getInventory(),
      ]);

      loadedSales.sort((a, b) => new Date(b.dateOfSale).getTime() - new Date(a.dateOfSale).getTime());
      setSalesData(loadedSales);
      setAllPurchasedProducts(archive);
      setInventoryState(inv);
    })();
  }, []);

  useEffect(() => {
    calculateTotals(startDate, endDate);
  }, [salesData, allPurchasedProducts, startDate, endDate]);

  const getUnitCost = (productName: string): number => {
    const purchasedProduct = allPurchasedProducts.find(p => p.productName === productName);
    if (purchasedProduct) {
      if (purchasedProduct.costPrice && !isNaN(parseFloat(purchasedProduct.costPrice))) {
        return parseFloat(purchasedProduct.costPrice);
      }
      const originalQty = parseInt(purchasedProduct.originalQuantityPurchased || "0", 10);
      const totalPaidPrice = parseFloat(purchasedProduct.pricePaid || "0");
      const unitCost = originalQty > 0 ? totalPaidPrice / originalQty : 0;
      return isNaN(unitCost) ? 0 : unitCost;
    }
    return 0;
  };

  const calculateTotals = (start: Date | null, end: Date | null) => {
    const allTimeTotalSpent = allPurchasedProducts.reduce((acc, product) => {
      const totalPaid = parseFloat(product.pricePaid || "0");
      return acc + (isNaN(totalPaid) ? 0 : totalPaid);
    }, 0);
    setTotalSpent(allTimeTotalSpent);

    let effectiveStartDate = start ? startOfDay(start) : new Date(0);
    let effectiveEndDate = end ? endOfDay(end) : new Date();

    const salesInRange = salesData.filter(sale => {
      const saleDate = new Date(sale.dateOfSale);
      return saleDate >= effectiveStartDate && saleDate <= effectiveEndDate;
    });
    setFilteredSalesData(salesInRange);

    let periodRevenue = 0;
    let periodProfit = 0;

    salesInRange.forEach(sale => {
      sale.productsSold.forEach(soldProduct => {
        const salePrice = parseFloat(soldProduct.salePrice || "0");
        const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);
        if (isNaN(salePrice) || isNaN(quantitySold) || quantitySold <= 0) return;

        const saleRevenueForItem = salePrice * quantitySold;
        periodRevenue += saleRevenueForItem;

        const unitCostPrice = getUnitCost(soldProduct.productName);
        periodProfit += (saleRevenueForItem - unitCostPrice * quantitySold);
      });
    });

    setTotalRevenue(periodRevenue);
    setTotalProfit(periodProfit);
  };

  const handleDateChange = (setter: React.Dispatch<React.SetStateAction<Date | null>>) => (date: Date | undefined) => {
    setter(date || null);
  };

  const clearDates = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const handleEditSale = (saleId: string) => {
    const saleToEdit = salesData.find(sale => sale.id === saleId);
    if (saleToEdit) {
      setSelectedSale(saleToEdit);
      setEditDateOfSale(new Date(saleToEdit.dateOfSale));
      setEditProductsSold(saleToEdit.productsSold.map(p => ({ ...p })));
      setOpenEditDialog(true);
    }
  };

  const handleUpdateSale = async () => {
    if (!selectedSale || !editDateOfSale) return;

    for (const product of editProductsSold) {
      if (!product.productName.trim()) {
        toast({ title: "Invalid Input", description: "Product name cannot be empty.", variant: "destructive" });
        return;
      }
      if (isNaN(parseFloat(product.salePrice)) || parseFloat(product.salePrice) < 0) {
        toast({ title: "Invalid Input", description: `Invalid sale price for ${product.productName}.`, variant: "destructive" });
        return;
      }
      if (isNaN(parseInt(product.quantitySold)) || parseInt(product.quantitySold) <= 0) {
        toast({ title: "Invalid Input", description: `Invalid quantity for ${product.productName}.`, variant: "destructive" });
        return;
      }
    }

    const updatedSale: SaleRecord = {
      ...selectedSale,
      dateOfSale: editDateOfSale.toISOString(),
      productsSold: editProductsSold,
    };

    try {
      await putSale(updatedSale);
      const allSales = await getSales();
      allSales.sort((a, b) => new Date(b.dateOfSale).getTime() - new Date(a.dateOfSale).getTime());
      setSalesData(allSales);
      setOpenEditDialog(false);
      setSelectedSale(null);
      toast({ title: "Sale Updated", description: "Sale details saved. Adjust inventory manually if quantities changed.", duration: 7000 });
    } catch (error) {
      console.error("Error saving updated sale:", error);
      toast({ title: "Storage Error", description: "Failed to save updated sale.", variant: "destructive" });
    }
  };

  const handleRemoveSale = async (saleId: string) => {
    const saleToRemove = salesData.find(sale => sale.id === saleId);
    if (!saleToRemove) return;

    try {
      let updatedInventory = [...inventory];
      let updatedArchive = [...allPurchasedProducts];

      saleToRemove.productsSold.forEach(soldProduct => {
        const qtySold = parseInt(soldProduct.quantitySold, 10);
        if (isNaN(qtySold) || qtySold <= 0) return;

        const invIndex = updatedInventory.findIndex(p => p.productName === soldProduct.productName);
        if (invIndex !== -1) {
          updatedInventory[invIndex] = {
            ...updatedInventory[invIndex],
            quantity: (parseInt(updatedInventory[invIndex].quantity, 10) + qtySold).toString(),
            updatedAt: new Date().toISOString(),
          };
        } else {
          const archiveProduct = allPurchasedProducts.find(p => p.productName === soldProduct.productName);
          if (archiveProduct) {
            updatedInventory.push({ ...archiveProduct, quantity: qtySold.toString(), updatedAt: new Date().toISOString() });
          }
        }

        const purchIndex = updatedArchive.findIndex(p => p.productName === soldProduct.productName);
        if (purchIndex !== -1) {
          updatedArchive[purchIndex] = {
            ...updatedArchive[purchIndex],
            quantity: (parseInt(updatedArchive[purchIndex].quantity, 10) + qtySold).toString(),
            updatedAt: new Date().toISOString(),
          };
        }
      });

      await deleteSale(saleId);
      await setInventory(updatedInventory);
      await setArchive(updatedArchive);

      const allSales = await getSales();
      allSales.sort((a, b) => new Date(b.dateOfSale).getTime() - new Date(a.dateOfSale).getTime());
      setSalesData(allSales);
      setInventoryState(updatedInventory);
      setAllPurchasedProducts(updatedArchive);
      setOpenRemoveDialog(null);

      toast({ title: "Sale Removed", description: `Sale ${saleId} removed and inventory adjusted.`, variant: "destructive" });
    } catch (error) {
      console.error("Error removing sale:", error);
      toast({ title: "Storage Error", description: "Failed to remove sale.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-6 sm:py-10 px-3 sm:px-4">
      <h1 className="page-title mb-10">Reports Dashboard</h1>

       <Card className="w-full max-w-4xl mb-10 shadow-md card">
         <CardHeader>
           <CardTitle className="flex items-center gap-2 text-lg">
             <CalendarDays className="h-5 w-5 text-primary" />
             Filter by Date Range
           </CardTitle>
           <CardDescription>Select start and end dates to view reports for a specific period. Leave blank for all time.</CardDescription>
         </CardHeader>
         <CardContent className="flex flex-col md:flex-row items-center gap-4">
             <div className="flex-1 w-full md:w-auto">
                 <Label htmlFor="start-date-btn" className="mb-1 block text-sm font-medium">Start Date</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button id="start-date-btn" variant={"outline"} className={cn("w-full justify-start text-left font-normal input", !startDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={startDate ?? undefined} onSelect={handleDateChange(setStartDate)} disabled={(date) => (endDate ? date > endDate : false) || date > today} initialFocus />
                    </PopoverContent>
                  </Popover>
             </div>
             <div className="flex-1 w-full md:w-auto">
                 <Label htmlFor="end-date-btn" className="mb-1 block text-sm font-medium">End Date</Label>
                 <Popover>
                    <PopoverTrigger asChild>
                      <Button id="end-date-btn" variant={"outline"} className={cn("w-full justify-start text-left font-normal input", !endDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={endDate ?? undefined} onSelect={handleDateChange(setEndDate)} disabled={(date) => (startDate ? date < startDate : false) || date > today} initialFocus />
                    </PopoverContent>
                  </Popover>
             </div>
              <Button onClick={clearDates} variant="outline" className="mt-4 md:mt-6 btn w-full md:w-auto md:self-end">
                 <FilterX className="mr-2 h-4 w-4" /> Clear Dates
              </Button>
         </CardContent>
       </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 w-full max-w-4xl mb-6 sm:mb-10">
            <Card className="card shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spending (All Time)</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">Total cost of all purchased products.</p>
            </CardContent>
            </Card>

            <Card className="card shadow-md hover:shadow-lg transition-shadow duration-200">
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

            <Card className="card shadow-md hover:shadow-lg transition-shadow duration-200">
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

      <div className="w-full max-w-4xl p-0">
        <Card className="card shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
               <ListOrdered className="h-5 w-5 text-primary"/>
               Sales Orders {startDate || endDate ? '(Filtered)' : '(All Time)'}
            </CardTitle>
            <CardDescription>Sales within the selected period (most recent first).</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[450px] w-full border rounded-md p-1">
              {filteredSalesData.length > 0 ? (
                <ul className="divide-y divide-border">
                  {filteredSalesData.map((sale) => {
                    let saleProfit = 0;
                    let saleRevenue = 0;
                    let saleCost = 0;

                    sale.productsSold.forEach((soldProduct) => {
                        const salePrice = parseFloat(soldProduct.salePrice || "0");
                        const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);
                        if (isNaN(salePrice) || isNaN(quantitySold) || quantitySold <= 0) return;

                        const itemRevenue = salePrice * quantitySold;
                        saleRevenue += itemRevenue;

                        const unitCostPrice = getUnitCost(soldProduct.productName);
                        const itemCost = unitCostPrice * quantitySold;
                        saleCost += itemCost;
                        saleProfit += (itemRevenue - itemCost);
                    });

                    return (
                      <li key={sale.id} className="p-4 hover:bg-accent/50 transition-colors group relative">
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-3 sm:gap-0">
                            <div>
                                <p className="font-semibold text-base">
                                Sale Date: {format(new Date(sale.dateOfSale), "PPP")}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">ID: {sale.id}</p>
                            </div>
                             <div className="text-left sm:text-right text-xs space-y-1 flex-shrink-0 sm:ml-4 bg-muted/40 px-3 py-2 rounded-md border subtle-border w-full sm:w-auto">
                                <div>Revenue: <span className="font-medium">${saleRevenue.toFixed(2)}</span></div>
                                <div>Cost: <span className="font-medium">${saleCost.toFixed(2)}</span></div>
                                <div className={cn("font-semibold", saleProfit >= 0 ? 'text-green-600' : 'text-red-600')}>
                                    Profit: {saleProfit < 0 ? '-' : ''}${Math.abs(saleProfit).toFixed(2)}
                                </div>
                            </div>
                        </div>
                        <div className="text-sm space-y-1.5">
                           <p className="font-medium text-foreground">Products Sold:</p>
                            <ul className="list-disc list-inside pl-2 space-y-1 text-muted-foreground">
                                {sale.productsSold.map((soldProduct, i) => (
                                <li key={i}>
                                    {soldProduct.productName} ({soldProduct.quantitySold} x ${parseFloat(soldProduct.salePrice).toFixed(2)})
                                </li>
                                ))}
                            </ul>
                        </div>
                          <div className="absolute top-3 right-3 flex justify-end gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                             <Button onClick={() => handleEditSale(sale.id)} variant="outline" size="icon" className="btn h-7 w-7">
                                <Edit className="h-4 w-4" />
                             </Button>
                             <Button onClick={() => setOpenRemoveDialog(sale.id)} variant="destructive" size="icon" className="btn h-7 w-7">
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
            <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
                <DialogTitle>Edit Sale Order (ID: {selectedSale?.id})</DialogTitle>
                <DialogDescription>Modify the details of this sale. Inventory levels are NOT automatically adjusted when editing.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
                 <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                     <Label htmlFor="edit-sale-date" className="sm:text-right">Date</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} id="edit-sale-date" className={cn("sm:col-span-3 justify-start text-left font-normal input", !editDateOfSale && "text-muted-foreground")}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editDateOfSale ? format(editDateOfSale, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={editDateOfSale} onSelect={setEditDateOfSale} disabled={(date) => date > today || date < new Date("2000-01-01")} initialFocus />
                        </PopoverContent>
                      </Popover>
                 </div>

                {editProductsSold.map((product, index) => (
                    <div key={`edit-${index}`} className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4 border-b pb-4">
                         <Label className="sm:text-right pt-2 sm:col-span-1 font-semibold">Item {index + 1}</Label>
                         <div className="sm:col-span-3 grid gap-2">
                             <Input value={product.productName} readOnly className="input bg-muted" title="Product name cannot be changed here"/>
                              <div className="grid grid-cols-3 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                                 <Label htmlFor={`edit-qty-${index}`} className="text-right text-xs">Qty</Label>
                                 <Input id={`edit-qty-${index}`} type="number" value={product.quantitySold} onChange={(e) => { const updated = [...editProductsSold]; updated[index].quantitySold = e.target.value; setEditProductsSold(updated); }} className="col-span-3 input" min="1" />
                              </div>
                               <div className="grid grid-cols-3 sm:grid-cols-4 items-center gap-2 sm:gap-4">
                                 <Label htmlFor={`edit-price-${index}`} className="text-right text-xs">Price</Label>
                                 <div className="relative col-span-2 sm:col-span-3">
                                     <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                     <Input id={`edit-price-${index}`} type="number" value={product.salePrice} onChange={(e) => { const updated = [...editProductsSold]; updated[index].salePrice = e.target.value; setEditProductsSold(updated); }} className="pl-8 input" step="0.01" min="0" />
                                </div>
                               </div>
                         </div>
                    </div>
                ))}
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
                <Button type="button" variant="secondary" onClick={() => setOpenEditDialog(false)} className="btn w-full sm:w-auto">Cancel</Button>
                <Button type="button" onClick={handleUpdateSale} className="btn-primary btn w-full sm:w-auto">Save Changes</Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>

       {/* Remove Confirmation Dialog */}
       <Dialog open={openRemoveDialog !== null} onOpenChange={() => setOpenRemoveDialog(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Confirm Sale Removal</DialogTitle>
             <DialogDescription>
               Are you sure you want to remove sale order <span className="font-bold">{openRemoveDialog}</span>? This will add the sold items back to your inventory.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter className="flex flex-col sm:flex-row gap-2">
             <Button variant="outline" onClick={() => setOpenRemoveDialog(null)} className="btn w-full sm:w-auto">Cancel</Button>
             <Button variant="destructive" onClick={() => handleRemoveSale(openRemoveDialog!)} className="btn w-full sm:w-auto">Confirm Removal</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}
