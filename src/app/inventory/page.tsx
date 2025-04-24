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
  DialogTrigger,
} from "@/components/ui/dialog";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";

interface ProductDetails {
  productName: string;
  pricePaid: string;
  quantityPurchased: string;
  costPrice?: string;
  productImage?: string;
}

export default function Inventory() {
  const [productDetails, setProductDetails] = useState<ProductDetails[]>([]);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const [editProductName, setEditProductName] = useState("");
  const [editPricePaid, setEditPricePaid] = useState("");
  const [editQuantityPurchased, setEditQuantityPurchased] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const {toast} = useToast();

  useEffect(() => {
    // Retrieve product details from local storage
    const storedDetails = localStorage.getItem("productDetails");
    if (storedDetails) {
      const parsedDetails = JSON.parse(storedDetails);
      // Filter out products with quantityPurchased equal to 0
      const filteredDetails = parsedDetails.filter(product => parseInt(product.quantityPurchased, 10) > 0);
      setProductDetails(filteredDetails);
    }
  }, []);

  const handleGoBack = () => {
    router.push("/"); // Navigate back to the main page
  };

  const handleEditProduct = (index: number) => {
    const product = productDetails[index];
    setSelectedProductIndex(index);
    setEditProductName(product.productName);
    setEditPricePaid(product.pricePaid);
    setEditQuantityPurchased(product.quantityPurchased);
    setEditCostPrice(product.costPrice || "");
    setOpen(true);
  };

  const handleUpdateProduct = () => {
    if (selectedProductIndex !== null) {
      const updatedProductDetails = [...productDetails];
      updatedProductDetails[selectedProductIndex] = {
        productName: editProductName,
        pricePaid: editPricePaid,
        quantityPurchased: editQuantityPurchased,
        costPrice: editCostPrice,
        productImage: productDetails[selectedProductIndex].productImage, // Keep the same image
      };

      localStorage.setItem("productDetails", JSON.stringify(updatedProductDetails));
      setProductDetails(updatedProductDetails);
      setOpen(false);
      toast({
        title: "Product updated!",
        description: `Product Name: ${editProductName}, Price Paid: ${editPricePaid}, Quantity: ${editQuantityPurchased}`,
      });
    }
  };

  const handleRemoveProduct = (index: number) => {
    const updatedProductDetails = [...productDetails];
    updatedProductDetails.splice(index, 1);

    // Filter out products with quantityPurchased equal to 0
    const filteredProductDetails = updatedProductDetails.filter(product => parseInt(product.quantityPurchased, 10) > 0);

    localStorage.setItem("productDetails", JSON.stringify(filteredProductDetails));
    setProductDetails(filteredProductDetails);
    toast({
      title: "Product removed!",
    });
  };

    const confirmRemoveProduct = (index: number) => {
        if (window.confirm("Are you sure you want to remove this product?")) {
            handleRemoveProduct(index);
        }
    };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10">
      <h1 className="text-3xl font-bold mb-4">Inventory</h1>
      {productDetails && productDetails.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {productDetails.map((product, index) => (
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
                  <p className="text-lg font-semibold">Quantity Purchased: {product.quantityPurchased}</p>
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
                value={editQuantityPurchased}
                onChange={(e) => setEditQuantityPurchased(e.target.value)}
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
