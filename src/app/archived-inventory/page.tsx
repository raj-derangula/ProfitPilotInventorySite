"use client";

import {useEffect, useState} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {useRouter} from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {Archive, Edit, Trash2, PlusCircle, PackageSearch, DollarSign} from "lucide-react";
import Image from 'next/image';
import { cn } from "@/lib/utils";
import {
  type InventoryItem,
  getArchive,
  putArchiveItem,
  deleteArchiveItem,
  getInventory,
  setInventory,
  initDB,
} from "@/lib/db";

export default function ArchivedInventory() {
  const [archivedProductDetails, setArchivedProductDetails] = useState<InventoryItem[]>([]);
  const router = useRouter();
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openRemoveDialog, setOpenRemoveDialog] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<InventoryItem | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editPricePaid, setEditPricePaid] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editOriginalQuantityPurchased, setEditOriginalQuantityPurchased] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const {toast} = useToast();

  useEffect(() => {
    (async () => {
      await initDB();
      const items = await getArchive();
      setArchivedProductDetails(items);
    })();
  }, []);

  const handleGoBack = () => {
    router.push("/");
  };

  const handleEditProduct = (product: InventoryItem) => {
    setSelectedProduct(product);
    setEditProductName(product.productName);
    setEditPricePaid(product.pricePaid);
    setEditQuantity(product.quantity);
    setEditOriginalQuantityPurchased(product.originalQuantityPurchased);
    setEditCostPrice(product.costPrice || "");
    setOpenEditDialog(true);
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return;

    if (!editProductName.trim() || parseFloat(editPricePaid) < 0 || parseInt(editQuantity, 10) < 0 || parseInt(editOriginalQuantityPurchased, 10) < 0 || (editCostPrice && parseFloat(editCostPrice) < 0)) {
      toast({ variant: "destructive", title: "Invalid Input", description: "Please ensure all fields are valid." });
      return;
    }

    const updated: InventoryItem = {
      ...selectedProduct,
      productName: editProductName,
      pricePaid: editPricePaid,
      quantity: editQuantity,
      originalQuantityPurchased: editOriginalQuantityPurchased,
      costPrice: editCostPrice || undefined,
      updatedAt: new Date().toISOString(),
    };

    await putArchiveItem(updated);
    const items = await getArchive();
    setArchivedProductDetails(items);
    setOpenEditDialog(false);
    toast({ title: "Archived Product Updated!", description: `${editProductName} details have been saved.` });
  };

  const handleRemoveProduct = async (id: string) => {
    const product = archivedProductDetails.find(p => p.id === id);
    if (!product) return;

    await deleteArchiveItem(id);

    // Also remove from current inventory
    const currentInventory = await getInventory();
    const updatedInventory = currentInventory.filter(p => p.productName !== product.productName);
    await setInventory(updatedInventory);

    const items = await getArchive();
    setArchivedProductDetails(items);
    setOpenRemoveDialog(null);
    toast({ title: "Product Permanently Removed!", description: `${product.productName} removed from archive and inventory.`, variant: "destructive" });
  };

  const calculateUnitPricePaid = (product: InventoryItem): string => {
    const price = parseFloat(product.pricePaid);
    const originalQty = parseInt(product.originalQuantityPurchased, 10);
    if (!isNaN(price) && !isNaN(originalQty) && originalQty > 0) {
      return (price / originalQty).toFixed(2);
    }
    return "N/A";
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-6 sm:py-10 px-3 sm:px-4">
       <div className="w-full max-w-6xl flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
         <h1 className="page-title text-center sm:text-left flex-grow flex items-center justify-center sm:justify-start gap-3 mb-0">
            <Archive className="h-8 w-8 text-primary"/> Archived Inventory
         </h1>
         <Button onClick={handleGoBack} className="btn-primary btn w-full sm:w-auto">
           <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
         </Button>
       </div>

      {archivedProductDetails && archivedProductDetails.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
          {archivedProductDetails.map((product) => (
            <Card key={product.id} className="card w-full flex flex-col overflow-hidden group">
              <CardHeader className="pb-2">
                 <div className="relative w-full h-48 mb-4 rounded-t-lg overflow-hidden border-b">
                   <Image
                     src={product.productImage || `https://picsum.photos/seed/${encodeURIComponent(product.productName)}/400/300`}
                     alt={product.productName}
                     layout="fill"
                     objectFit="cover"
                     className="transition-transform duration-300 group-hover:scale-105"
                     data-ai-hint="archived product"
                   />
                 </div>
                <CardTitle className="text-lg font-semibold truncate" title={product.productName}>{product.productName}</CardTitle>
                <CardDescription>Originally Purchased: <span className="font-medium text-foreground">{product.originalQuantityPurchased}</span></CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm flex-grow px-4 sm:px-6 pb-4 pt-0">
                 <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className={cn("font-semibold", parseInt(product.quantity, 10) <= 0 ? 'text-destructive' : 'text-foreground')}>{product.quantity}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Price Paid:</span>
                  <span className="font-semibold">${parseFloat(product.pricePaid).toFixed(2)}</span>
                </div>
                {product.costPrice && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Unit Cost Price:</span>
                    <span className="font-semibold">${parseFloat(product.costPrice).toFixed(2)}</span>
                  </div>
                )}
                 <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Unit Price Paid:</span>
                  <span className="font-semibold">${calculateUnitPricePaid(product)}</span>
                </div>
                {product.category && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium text-xs truncate max-w-[150px]" title={product.category}>{product.category}</span>
                  </div>
                )}
                {product.sourcePlatform && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Source:</span>
                    <span className="font-medium text-xs">{product.sourcePlatform}</span>
                  </div>
                )}
              </CardContent>
               <div className="p-4 pt-2 mt-auto border-t border-border/50 flex justify-end gap-2 bg-muted/30">
                  <Button onClick={() => handleEditProduct(product)} variant="outline" size="sm" className="btn">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setOpenRemoveDialog(product.id)} variant="destructive" size="sm" className="btn">
                    <Trash2 className="h-4 w-4" />
                  </Button>
               </div>
            </Card>
          ))}
        </div>
      ) : (
         <div className="text-center py-16 w-full max-w-md mx-auto bg-card p-10 rounded-lg shadow-md border">
            <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Archive is Empty</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Products you purchase will appear here for historical tracking.
            </p>
             <Button className="mt-6 btn-primary btn w-full" onClick={handleGoBack}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Your First Product
            </Button>
        </div>
      )}

      {/* Edit Product Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Archived Product</DialogTitle>
            <DialogDescription>Make changes to the archived product details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="name" className="sm:text-right">Name</Label>
              <Input id="name" value={editProductName} onChange={(e) => setEditProductName(e.target.value)} className="sm:col-span-3 input" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="price" className="sm:text-right">Total Price Paid</Label>
              <div className="relative sm:col-span-3">
                 <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                 <Input id="price" type="number" value={editPricePaid} onChange={(e) => setEditPricePaid(e.target.value)} className="col-span-3 pl-8 input" step="0.01" min="0" />
              </div>
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="originalQuantity" className="sm:text-right">Original Qty</Label>
              <Input id="originalQuantity" type="number" value={editOriginalQuantityPurchased} onChange={(e) => setEditOriginalQuantityPurchased(e.target.value)} className="sm:col-span-3 input" min="0" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="quantity" className="sm:text-right">Current Qty</Label>
              <Input id="quantity" type="number" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} className="sm:col-span-3 input" min="0" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 sm:gap-4">
              <Label htmlFor="cost" className="sm:text-right">Unit Cost Price</Label>
              <div className="relative sm:col-span-3">
                 <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                 <Input id="cost" type="number" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} className="col-span-3 pl-8 input" placeholder="Optional" step="0.01" min="0" />
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
             <Button type="button" variant="secondary" onClick={() => setOpenEditDialog(false)} className="btn w-full sm:w-auto">Cancel</Button>
             <Button type="button" onClick={handleUpdateProduct} className="btn-primary btn w-full sm:w-auto">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Remove Confirmation Dialog */}
       <Dialog open={openRemoveDialog !== null} onOpenChange={() => setOpenRemoveDialog(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Confirm Permanent Removal</DialogTitle>
             <DialogDescription>
               Are you sure you want to permanently remove <span className="font-bold">{archivedProductDetails.find(p => p.id === openRemoveDialog)?.productName}</span> from the archive and current inventory? This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter className="flex flex-col sm:flex-row gap-2">
             <Button variant="outline" onClick={() => setOpenRemoveDialog(null)} className="btn w-full sm:w-auto">Cancel</Button>
             <Button variant="destructive" onClick={() => handleRemoveProduct(openRemoveDialog!)} className="btn w-full sm:w-auto">Confirm Removal</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}
