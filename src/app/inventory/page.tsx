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
import {Edit, Trash2, PlusCircle, DollarSign} from "lucide-react"; // Added icons
import Image from 'next/image'; // Import next/image

interface ProductDetails {
  productName: string;
  pricePaid: string; // Total price paid for original quantity
  quantity: string; // Current quantity in stock
  originalQuantityPurchased: string; // Original quantity bought
  costPrice?: string; // Optional cost per unit
  productImage?: string;
}

export default function Inventory() {
  const [productDetails, setProductDetails] = useState<ProductDetails[]>([]);
  const router = useRouter();
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openRemoveDialog, setOpenRemoveDialog] = useState<number | null>(null); // Store index to remove
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editPricePaid, setEditPricePaid] = useState(""); // This should likely be total price paid
  const [editQuantity, setEditQuantity] = useState(""); // Current quantity
  const [editOriginalQuantityPurchased, setEditOriginalQuantityPurchased] = useState(""); // Keep original quantity
  const [editCostPrice, setEditCostPrice] = useState("");
  const {toast} = useToast();

 useEffect(() => {
    // Retrieve product details from local storage
    const storedDetails = localStorage.getItem("productDetails");
    if (storedDetails) {
      try {
          const parsedDetails = JSON.parse(storedDetails);
          // Ensure it's an array and filter out products with quantity 0 or less
          if (Array.isArray(parsedDetails)) {
              const filteredDetails = parsedDetails.filter(product => product && parseInt(product.quantity, 10) > 0);
              setProductDetails(filteredDetails);
          } else {
              localStorage.removeItem("productDetails"); // Clear invalid data
          }
      } catch (e) {
          console.error("Failed to parse product details from localStorage:", e);
          localStorage.removeItem("productDetails"); // Clear invalid data
      }
    }
 }, []);


  const handleGoBack = () => {
    router.push("/"); // Navigate back to the main page
  };

  const handleEditProduct = (index: number) => {
    const product = productDetails[index];
    setSelectedProductIndex(index);
    setEditProductName(product.productName);
    setEditPricePaid(product.pricePaid); // Total price paid
    setEditQuantity(product.quantity); // Current quantity
    setEditOriginalQuantityPurchased(product.originalQuantityPurchased); // Original quantity (usually not edited here)
    setEditCostPrice(product.costPrice || ""); // Unit cost price
    setOpenEditDialog(true);
  };

  const handleUpdateProduct = () => {
    if (selectedProductIndex !== null) {
        // Basic validation
        if (!editProductName.trim() || parseFloat(editPricePaid) < 0 || parseInt(editQuantity, 10) < 0 || (editCostPrice && parseFloat(editCostPrice) < 0)) {
            toast({
                variant: "destructive",
                title: "Invalid Input",
                description: "Please ensure all fields are valid.",
            });
            return;
        }

      const updatedProductDetails = [...productDetails];
      updatedProductDetails[selectedProductIndex] = {
        ...updatedProductDetails[selectedProductIndex], // Keep other properties like productImage
        productName: editProductName,
        pricePaid: editPricePaid, // Keep total price paid
        quantity: editQuantity, // Update current quantity
        costPrice: editCostPrice || undefined, // Update unit cost price
        // originalQuantityPurchased is usually not updated here, but kept from initial load
      };

      localStorage.setItem("productDetails", JSON.stringify(updatedProductDetails));
      setProductDetails(updatedProductDetails.filter(p => parseInt(p.quantity, 10) > 0)); // Update state and filter
      setOpenEditDialog(false);
      toast({
        title: "Product Updated!",
        description: `${editProductName} details have been saved.`,
      });
    }
  };

    const handleRemoveProduct = (index: number) => {
        const productToRemove = productDetails[index];
        const updatedProductDetails = productDetails.filter((_, i) => i !== index);

        localStorage.setItem("productDetails", JSON.stringify(updatedProductDetails));
        setProductDetails(updatedProductDetails);
        setOpenRemoveDialog(null); // Close confirmation dialog
        toast({
            title: "Product Removed!",
            description: `${productToRemove.productName} has been removed from inventory.`,
        });
    };

   // Calculate unit price paid for display
   const calculateUnitPricePaid = (product: ProductDetails): string => {
     const price = parseFloat(product.pricePaid);
     const originalQty = parseInt(product.originalQuantityPurchased, 10);
     if (!isNaN(price) && !isNaN(originalQty) && originalQty > 0) {
       return (price / originalQty).toFixed(2);
     }
     return "N/A"; // Or handle error appropriately
   };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10 px-4">
      <div className="w-full max-w-6xl flex justify-between items-center mb-8">
        <h1 className="page-title text-left flex-grow">Inventory</h1>
        <Button onClick={handleGoBack} className="btn-primary">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Product
        </Button>
      </div>

      {productDetails && productDetails.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-6xl">
          {productDetails.map((product, index) => (
            <Card key={index} className="w-full transition-transform transform hover:scale-105 hover:shadow-xl flex flex-col">
              <CardHeader className="pb-2">
                 {/* Product Image */}
                 <div className="relative w-full h-48 mb-4 rounded-t-lg overflow-hidden">
                   <Image
                     src={product.productImage || `https://picsum.photos/seed/${encodeURIComponent(product.productName)}/400/300`}
                     alt={product.productName}
                     layout="fill"
                     objectFit="cover"
                     data-ai-hint="product item"
                   />
                 </div>
                <CardTitle className="text-lg font-semibold truncate" title={product.productName}>{product.productName}</CardTitle>
                <CardDescription>Current Stock: <span className="font-medium text-foreground">{product.quantity}</span></CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm flex-grow">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Unit Price Paid:</span>
                  <span className="font-semibold">${calculateUnitPricePaid(product)}</span>
                </div>
                 {product.costPrice && (
                   <div className="flex justify-between items-center">
                     <span className="text-muted-foreground">Unit Cost Price:</span>
                     <span className="font-semibold">${parseFloat(product.costPrice).toFixed(2)}</span>
                   </div>
                 )}
              </CardContent>
               <div className="p-4 pt-2 mt-auto border-t border-border/50 flex justify-end gap-2">
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
        <div className="text-center py-16">
            <PackageSearch className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Products Found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
                Your inventory is empty. Add a product to get started.
            </p>
            <Button className="mt-6 btn-primary" onClick={handleGoBack}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add First Product
            </Button>
        </div>
      )}

      {/* Edit Product Dialog */}
      <Dialog open={openEditDialog} onOpenChange={setOpenEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Make changes to your product details. Click save when finished.</DialogDescription>
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
                    className="pl-8 input"
                    step="0.01"
                    min="0"
                  />
               </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="col-span-3 input"
                min="0" // Allow 0, filtering happens on display/storage
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
                   className="pl-8 input"
                   placeholder="Optional"
                   step="0.01"
                   min="0"
                 />
               </div>
            </div>
             {/* Original quantity is usually not edited */}
             {/*<div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="originalQuantity" className="text-right">
                Original Qty
              </Label>
              <Input
                id="originalQuantity"
                value={editOriginalQuantityPurchased}
                 readOnly // Generally shouldn't edit original purchase qty here
                className="col-span-3 bg-muted"
              />
            </div> */}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button type="button" onClick={handleUpdateProduct} className="btn-primary">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

       {/* Remove Confirmation Dialog */}
       <Dialog open={openRemoveDialog !== null} onOpenChange={() => setOpenRemoveDialog(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Confirm Removal</DialogTitle>
             <DialogDescription>
               Are you sure you want to remove <span className="font-bold">{productDetails[openRemoveDialog!]?.productName}</span> from your inventory? This action cannot be undone.
             </DialogDescription>
           </DialogHeader>
           <DialogFooter>
             <Button variant="outline" onClick={() => setOpenRemoveDialog(null)}>
               Cancel
             </Button>
             <Button variant="destructive" onClick={() => handleRemoveProduct(openRemoveDialog!)} className="btn">
               Remove Product
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

    </div>
  );
}

// Helper component for empty state
import { PackageSearch } from 'lucide-react';
