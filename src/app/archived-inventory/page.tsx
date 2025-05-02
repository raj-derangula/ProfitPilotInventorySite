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
  DialogClose
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {Archive, Edit, Trash2, PlusCircle, PackageSearch, DollarSign} from "lucide-react"; // Added icons
import Image from 'next/image'; // Import next/image
import { cn } from "@/lib/utils";

interface StoredProductDetails {
  productName: string;
  pricePaid: string; // Total price for original quantity
  quantity: string; // Current stock or final quantity in archive
  originalQuantityPurchased: string;
  costPrice?: string; // Unit cost
  productImage?: string;
}


export default function ArchivedInventory() {
  const [archivedProductDetails, setArchivedProductDetails] = useState<StoredProductDetails[]>([]);
  const router = useRouter();
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openRemoveDialog, setOpenRemoveDialog] = useState<number | null>(null); // Store index to remove
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editPricePaid, setEditPricePaid] = useState("");
  const [editQuantity, setEditQuantity] = useState(""); // Current quantity (could be 0)
  const [editOriginalQuantityPurchased, setEditOriginalQuantityPurchased] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const {toast} = useToast();

  // Function to safely parse JSON from local storage
  const safelyParseJSON = (key: string): StoredProductDetails[] => {
      const storedValue = localStorage.getItem(key);
      if (storedValue) {
          try {
              const parsed = JSON.parse(storedValue);
              // Ensure it's an array before returning
              if (Array.isArray(parsed)) {
                  // TODO: Add deeper validation of array items if needed
                  return parsed;
              }
              console.warn(`Data for key "${key}" is not an array, clearing.`);
          } catch (e) {
              console.error(`Error parsing JSON from localStorage key "${key}":`, e);
          }
          // Clear invalid data
          localStorage.removeItem(key);
      }
      return []; // Return empty array if not found or invalid
  };


  useEffect(() => {
    // Retrieve product details from local storage
    const storedDetails = safelyParseJSON("purchasedProducts");
    setArchivedProductDetails(storedDetails);
  }, []);

  const handleGoBack = () => {
    router.push("/"); // Navigate back to the main page
  };

  const handleEditProduct = (index: number) => {
    const product = archivedProductDetails[index];
    setSelectedProductIndex(index);
    setEditProductName(product.productName);
    setEditPricePaid(product.pricePaid);
    setEditQuantity(product.quantity); // Current quantity
    setEditOriginalQuantityPurchased(product.originalQuantityPurchased);
    setEditCostPrice(product.costPrice || "");
    setOpenEditDialog(true);
  };

 const handleUpdateProduct = () => {
    if (selectedProductIndex !== null) {
        // Basic validation
        if (!editProductName.trim() || parseFloat(editPricePaid) < 0 || parseInt(editQuantity, 10) < 0 || parseInt(editOriginalQuantityPurchased, 10) < 0 || (editCostPrice && parseFloat(editCostPrice) < 0)) {
             toast({
                variant: "destructive",
                title: "Invalid Input",
                description: "Please ensure all fields are valid.",
             });
             return;
        }

      const updatedProductDetails = [...archivedProductDetails];
      updatedProductDetails[selectedProductIndex] = {
        ...updatedProductDetails[selectedProductIndex], // Keep other props like image
        productName: editProductName,
        pricePaid: editPricePaid,
        quantity: editQuantity, // Update current quantity (can be 0)
        originalQuantityPurchased: editOriginalQuantityPurchased,
        costPrice: editCostPrice || undefined, // Update unit cost price
        // productImage is kept via spread operator
      };

      localStorage.setItem("purchasedProducts", JSON.stringify(updatedProductDetails));
      setArchivedProductDetails(updatedProductDetails);
      setOpenEditDialog(false);
      toast({
        title: "Archived Product Updated!",
        description: `${editProductName} details have been saved.`,
      });
    }
  };


    const handleRemoveProduct = (index: number) => {
        const productToRemove = archivedProductDetails[index];
        if (!productToRemove) return; // Should not happen if index is valid

        // 1. Remove from Archived Inventory (purchasedProducts)
        const updatedArchivedDetails = archivedProductDetails.filter((_, i) => i !== index);
        localStorage.setItem("purchasedProducts", JSON.stringify(updatedArchivedDetails));
        setArchivedProductDetails(updatedArchivedDetails); // Update state

        // 2. Remove from Current Inventory (productDetails)
        const currentInventory = safelyParseJSON("productDetails");
        const updatedCurrentInventory = currentInventory.filter(p => p.productName !== productToRemove.productName); // Assuming productName is the unique identifier
        localStorage.setItem("productDetails", JSON.stringify(updatedCurrentInventory));

        // 3. Close dialog and show toast
        setOpenRemoveDialog(null); // Close confirmation dialog
        toast({
            title: "Product Permanently Removed!",
            description: `${productToRemove.productName} has been removed from the archive and current inventory.`,
            variant: "destructive" // Use destructive variant for permanent removal
        });
    };

  // Calculate unit price paid for display
   const calculateUnitPricePaid = (product: StoredProductDetails): string => {
     const price = parseFloat(product.pricePaid);
     const originalQty = parseInt(product.originalQuantityPurchased, 10);
     if (!isNaN(price) && !isNaN(originalQty) && originalQty > 0) {
       return (price / originalQty).toFixed(2);
     }
     return "N/A"; // Or handle error appropriately
   };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10 px-4">
       <div className="w-full max-w-6xl flex justify-between items-center mb-10"> {/* Increased margin */}
         <h1 className="page-title text-left flex-grow flex items-center gap-3 mb-0"> {/* Added gap, removed margin */}
            <Archive className="h-8 w-8 text-primary"/> Archived Inventory
         </h1>
         <Button onClick={handleGoBack} className="btn-primary btn">
           <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
         </Button>
       </div>

      {archivedProductDetails && archivedProductDetails.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
          {archivedProductDetails.map((product, index) => (
            <Card key={index} className="card w-full flex flex-col overflow-hidden group"> {/* Added group */}
              <CardHeader className="pb-2">
                 {/* Product Image */}
                 <div className="relative w-full h-48 mb-4 rounded-t-lg overflow-hidden border-b"> {/* Added border */}
                   <Image
                     src={product.productImage || `https://picsum.photos/seed/${encodeURIComponent(product.productName)}/400/300`}
                     alt={product.productName}
                     layout="fill"
                     objectFit="cover"
                     className="transition-transform duration-300 group-hover:scale-105" // Added effect
                     data-ai-hint="archived product"
                   />
                 </div>
                <CardTitle className="text-lg font-semibold truncate" title={product.productName}>{product.productName}</CardTitle>
                <CardDescription>Originally Purchased: <span className="font-medium text-foreground">{product.originalQuantityPurchased}</span></CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm flex-grow px-6 pb-4 pt-0"> {/* Adjusted padding */}
                 <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className={cn("font-semibold", parseInt(product.quantity, 10) <= 0 ? 'text-destructive' : 'text-foreground')}>{product.quantity}</span> {/* Use text-foreground for non-zero */}
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
              </CardContent>
               <div className="p-4 pt-2 mt-auto border-t border-border/50 flex justify-end gap-2 bg-muted/30"> {/* Added bg */}
                  <Button onClick={() => handleEditProduct(index)} variant="outline" size="sm" className="btn">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setOpenRemoveDialog(index)} variant="destructive" size="sm" className="btn">
                    <Trash2 className="h-4 w-4" />
                  </Button>
               </div>
            </Card>
          ))}
        </div>
      ) : (
         <div className="text-center py-16 w-full max-w-md mx-auto bg-card p-10 rounded-lg shadow-md border"> {/* Enhanced empty state */}
            <Archive className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Archive is Empty</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                Products you purchase will appear here for historical tracking, even after they are sold out or removed from current inventory.
            </p>
             <Button className="mt-6 btn-primary btn" onClick={handleGoBack}>
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
            <DialogDescription>Make changes to the archived product details. Click save when finished.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" value={editProductName} onChange={(e) => setEditProductName(e.target.value)} className="col-span-3 input" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Total Price Paid
              </Label>
              <div className="relative col-span-3">
                 <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                 <Input
                    id="price"
                    type="number"
                    value={editPricePaid}
                    onChange={(e) => setEditPricePaid(e.target.value)}
                    className="col-span-3 pl-8 input" // Use input class
                    step="0.01" min="0"
                  />
              </div>
            </div>
             <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="originalQuantity" className="text-right">
                Original Qty
              </Label>
              <Input
                id="originalQuantity"
                type="number"
                value={editOriginalQuantityPurchased}
                onChange={(e) => setEditOriginalQuantityPurchased(e.target.value)}
                className="col-span-3 input" // Use input class
                min="0"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Current Qty
              </Label>
              <Input
                id="quantity"
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="col-span-3 input" // Use input class
                min="0"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cost" className="text-right">
                 Unit Cost Price
              </Label>
              <div className="relative col-span-3">
                 <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                 <Input
                    id="cost"
                    type="number"
                    value={editCostPrice}
                    onChange={(e) => setEditCostPrice(e.target.value)}
                    className="col-span-3 pl-8 input" // Use input class
                    placeholder="Optional"
                    step="0.01" min="0"
                  />
              </div>
            </div>
          </div>
          <DialogFooter>
             <Button type="button" variant="secondary" onClick={() => setOpenEditDialog(false)} className="btn">Cancel</Button>
            <Button type="button" onClick={handleUpdateProduct} className="btn-primary btn">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Remove Confirmation Dialog */}
       <Dialog open={openRemoveDialog !== null} onOpenChange={() => setOpenRemoveDialog(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Confirm Permanent Removal</DialogTitle>
             <DialogDescription>
               Are you sure you want to permanently remove <span className="font-bold">{archivedProductDetails[openRemoveDialog!]?.productName}</span> from the archive and current inventory? This will affect historical reporting data. This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={() => setOpenRemoveDialog(null)} className="btn">
               Cancel
             </Button>
             <Button variant="destructive" onClick={() => handleRemoveProduct(openRemoveDialog!)} className="btn">
               Confirm Removal
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

    </div>
  );
}
