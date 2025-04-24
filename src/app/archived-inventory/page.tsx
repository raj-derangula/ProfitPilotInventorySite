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
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";

interface ProductDetails {
  productName: string;
  pricePaid: string;
  quantity: string;
  originalQuantityPurchased: string; // New variable
  costPrice?: string;
  productImage?: string;
}

export default function ArchivedInventory() {
  const [archivedProductDetails, setArchivedProductDetails] = useState<ProductDetails[]>([]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editPricePaid, setEditPricePaid] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editOriginalQuantityPurchased, setEditOriginalQuantityPurchased] = useState(""); // New variable
  const [editCostPrice, setEditCostPrice] = useState("");
  const {toast} = useToast();

  useEffect(() => {
    // Retrieve product details from local storage
    const storedDetails = localStorage.getItem("purchasedProducts");
    if (storedDetails) {
      setArchivedProductDetails(JSON.parse(storedDetails));
    }
  }, []);

  const handleGoBack = () => {
    router.push("/"); // Navigate back to the main page
  };

  const handleEditProduct = (index: number) => {
    const product = archivedProductDetails[index];
    setSelectedProductIndex(index);
    setEditProductName(product.productName);
    setEditPricePaid(product.pricePaid);
    setEditQuantity(product.quantity);
    setEditOriginalQuantityPurchased(product.originalQuantityPurchased); // set new variable
    setEditCostPrice(product.costPrice || "");
    setOpen(true);
  };

  const handleUpdateProduct = () => {
    if (selectedProductIndex !== null) {
      const updatedProductDetails = [...archivedProductDetails];
      updatedProductDetails[selectedProductIndex] = {
        productName: editProductName,
        pricePaid: editPricePaid,
        quantity: editQuantity,
        originalQuantityPurchased: editOriginalQuantityPurchased, // update new variable
        costPrice: editCostPrice,
        productImage: archivedProductDetails[selectedProductIndex].productImage, // Keep the same image
      };

      localStorage.setItem("purchasedProducts", JSON.stringify(updatedProductDetails));
      setArchivedProductDetails(updatedProductDetails);
      setOpen(false);
      toast({
        title: "Product updated!",
        description: `Product Name: ${editProductName}, Price Paid: ${editPricePaid}, Quantity: ${editQuantity}`,
      });
    }
  };

  const handleRemoveProduct = (index: number) => {
    const updatedProductDetails = [...archivedProductDetails];
    updatedProductDetails.splice(index, 1);

    localStorage.setItem("purchasedProducts", JSON.stringify(updatedProductDetails));
    setArchivedProductDetails(updatedProductDetails);
    toast({
      title: "Product removed!",
    });
  };

  const confirmRemoveProduct = (index: number) => {
    if (window.confirm("Are you sure you want to permanently remove this product from the archive?")) {
      handleRemoveProduct(index);
    }
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10">
      <h1 className="text-3xl font-bold mb-4">Archived Inventory</h1>
      {archivedProductDetails && archivedProductDetails.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {archivedProductDetails.map((product, index) => (
            <Card key={index} className="w-full max-w-4xl">
              <CardHeader>
                <CardTitle>{product.productName}</CardTitle>
                <CardDescription>Here are the details of your product.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {product.productImage && (
                  <img
                    src={product.productImage}
                    alt={product.productName}
                    className="max-w-full h-auto rounded-md"
                  />
                )}
                <div className="flex flex-col space-y-1">
                  <p className="text-lg font-semibold">Price Paid: ${product.pricePaid}</p>
                  <p className="text-lg font-semibold">Quantity: {product.quantity}</p>
                  <p className="text-lg font-semibold">Original Quantity Purchased: {product.originalQuantityPurchased}</p>
                  {product.costPrice && (
                    <p className="text-lg font-semibold">Cost Price: ${product.costPrice}</p>
                  )}
                </div>
                <div className="flex justify-between">
                  <Button onClick={() => handleEditProduct(index)} variant="secondary">
                    Edit
                  </Button>
                  <Button onClick={() => confirmRemoveProduct(index)} variant="destructive">
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p>No product details found. Please add a product.</p>
      )}
      <Button className="mt-4" onClick={handleGoBack}>
        Add New Product
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Make changes to your product details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Name
              </Label>
              <Input id="name" value={editProductName} onChange={(e) => setEditProductName(e.target.value)} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="price" className="text-right">
                Price Paid
              </Label>
              <Input
                id="price"
                value={editPricePaid}
                onChange={(e) => setEditPricePaid(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="quantity" className="text-right">
                Quantity
              </Label>
              <Input
                id="quantity"
                value={editQuantity}
                onChange={(e) => setEditQuantity(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="originalQuantity" className="text-right">
                Original Quantity
              </Label>
              <Input
                id="originalQuantity"
                value={editOriginalQuantityPurchased}
                onChange={(e) => setEditOriginalQuantityPurchased(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="cost" className="text-right">
                Cost Price
              </Label>
              <Input id="cost" value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value)} className="col-span-3" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleUpdateProduct}>Update Product</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
