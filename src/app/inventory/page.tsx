"use client";

import {useEffect, useState} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {useRouter} from "next/navigation";

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

  useEffect(() => {
    // Retrieve product details from local storage
    const storedDetails = localStorage.getItem("productDetails");
    if (storedDetails) {
      setProductDetails(JSON.parse(storedDetails));
    }
  }, []);

  const handleGoBack = () => {
    router.push("/"); // Navigate back to the main page
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
    </div>
  );
}
