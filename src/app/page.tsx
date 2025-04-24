"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {extractProductDetails} from "@/ai/flows/extract-product-details";
import {MarketTrendData, getMarketTrendData} from "@/services/market-trends";
import {LucideIcon, Upload, X} from "lucide-react";
import {FormField, FormItem, FormLabel, FormControl, FormDescription, Form, useFormField} from "@/components/ui/form";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {Textarea} from "@/components/ui/textarea";
import {useRouter} from "next/navigation";

const productDetailsSchema = z.object({
  productName: z.string().min(2, {
    message: "Product name must be at least 2 characters.",
  }),
  pricePaid: z.string().refine((value) => {
    try {
      const num = parseFloat(value);
      return !isNaN(num) && num > 0;
    } catch (e) {
      return false;
    }
  }, {
    message: "Price paid must be a valid number greater than zero.",
  }),
  quantityPurchased: z.string().refine((value) => {
    try {
      const num = parseInt(value, 10);
      return !isNaN(num) && num > 0;
    } catch (e) {
      return false;
    }
  }, {
    message: "Quantity purchased must be a valid integer greater than zero.",
  }),
  originalQuantityPurchased: z.string().refine((value) => {
    try {
      const num = parseInt(value, 10);
      return !isNaN(num) && num > 0;
    } catch (e) {
      return false;
    }
  }, {
    message: "Quantity purchased must be a valid integer greater than zero.",
  }),
  costPrice: z.string().optional(),
  productImage: z.string().optional(),
});

interface ProductDetailsFormValues extends z.infer<typeof productDetailsSchema> {}

export default function Home() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [suggestedSellingPrice, setSuggestedSellingPrice] = useState<number | null>(null);
  const {toast} = useToast();
  const router = useRouter();

  const form = useForm<ProductDetailsFormValues>({
    resolver: zodResolver(productDetailsSchema),
    defaultValues: {
      productName: "",
      pricePaid: "",
      quantityPurchased: "",
      originalQuantityPurchased: "",
      costPrice: "",
      productImage: "",
    },
  });

  useEffect(() => {
    // Load product details from local storage on component mount
    const storedProducts = localStorage.getItem("productDetails");
    if (storedProducts) {
      try {
        JSON.parse(storedProducts);
      } catch (e) {
        localStorage.removeItem("productDetails");
      }
    }
    const storedPurchasedProducts = localStorage.getItem("purchasedProducts");
    if (storedPurchasedProducts) {
      try {
        JSON.parse(storedPurchasedProducts);
      } catch (e) {
        localStorage.removeItem("purchasedProducts");
      }
    }
  }, []);

  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUri = reader.result as string;
      setScreenshot(dataUri);
      form.setValue("productImage", dataUri); // Set the screenshot as the product image
      try {
        const productDetails = await extractProductDetails({screenshotDataUri: dataUri});
        form.setValue("productName", productDetails.productName);
        form.setValue("pricePaid", productDetails.pricePaid.toString());
        form.setValue("quantityPurchased", productDetails.quantityPurchased.toString());
        form.setValue("originalQuantityPurchased", productDetails.quantityPurchased.toString());
        toast({
          title: "Product details extracted!",
          description: `Product Name: ${productDetails.productName}, Price Paid: ${productDetails.pricePaid}, Quantity: ${productDetails.quantityPurchased}`,
        });
      } catch (error: any) {
        console.error("Error extracting product details:", error);
        toast({
          variant: "destructive",
          title: "Error extracting product details",
          description: error.message || "Failed to extract product details from the screenshot.",
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const calculateSuggestedPrice = async () => {
    try {
      const productName = form.getValues("productName");
      const marketTrendData: MarketTrendData = await getMarketTrendData(productName);
      setSuggestedSellingPrice(marketTrendData.averagePrice * 1.2); // Suggest 20% above average
      toast({
        title: "Suggested selling price calculated!",
        description: `Based on market trends, a selling price of $${(marketTrendData.averagePrice * 1.2).toFixed(2)} is suggested.`,
      });
    } catch (error: any) {
      console.error("Error calculating suggested price:", error);
      toast({
        variant: "destructive",
        title: "Error calculating suggested price",
        description: error.message || "Failed to calculate suggested selling price.",
      });
    }
  };

  const onSubmit = (values: ProductDetailsFormValues) => {
    // Retrieve existing product details from local storage
    const storedProducts = localStorage.getItem("productDetails");
    const storedPurchasedProducts = localStorage.getItem("purchasedProducts");

    // Ensure existingProducts is always an array, even if storedProducts is null or empty
    const existingProducts = storedProducts ? JSON.parse(storedProducts) : [];
    const existingPurchasedProducts = storedPurchasedProducts ? JSON.parse(storedPurchasedProducts) : [];

    // Add the new product to the existing list
    const updatedProducts = Array.isArray(existingProducts) ? [...existingProducts, values] : [values];
    const updatedPurchasedProducts = Array.isArray(existingPurchasedProducts) ? [...existingPurchasedProducts, values] : [values];

    // Filter out products with quantityPurchased equal to 0
    const filteredProducts = updatedProducts.filter(product => parseInt(product.quantityPurchased, 10) > 0);

    // Store the updated list in local storage
    localStorage.setItem("productDetails", JSON.stringify(filteredProducts));
    localStorage.setItem("purchasedProducts", JSON.stringify(updatedPurchasedProducts));

    toast({
      title: "Product added!",
      description: `Product Name: ${values.productName}, Price Paid: ${values.pricePaid}, Quantity: ${values.quantityPurchased}`,
    });
    router.push("/inventory"); // Redirect to inventory page after submission
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    form.setValue("productName", "");
    form.setValue("pricePaid", "");
    form.setValue("quantityPurchased", "");
    form.setValue("originalQuantityPurchased", "");
    form.setValue("productImage", "https://picsum.photos/200/300"); // Clear the product image
  };

  const handleChangeScreenshot = () => {
    // Trigger the file input click event
    const fileInput = document.getElementById("screenshot-upload") as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10">
      <h1 className="text-3xl font-bold mb-4">ProfitPilot</h1>
      <div className="flex flex-col md:flex-row gap-4 w-full max-w-4xl p-4">
        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Upload Screenshot</CardTitle>
            <CardDescription>Upload an order confirmation screenshot to extract product details.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {screenshot ? (
              <div className="relative">
                <img src={screenshot} alt="Order Confirmation" className="max-w-full h-auto mb-4 rounded-md"/>
                <div className="absolute top-2 right-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-background text-muted-foreground hover:bg-secondary mr-2"
                    onClick={handleRemoveScreenshot}
                  >
                    <X className="h-4 w-4"/>
                    <span className="sr-only">Remove Screenshot</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="bg-background text-muted-foreground hover:bg-secondary"
                    onClick={handleChangeScreenshot}
                  >
                    <Upload className="h-4 w-4"/>
                    <span className="sr-only">Change Screenshot</span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Label htmlFor="screenshot-upload" className="cursor-pointer py-3">
                  <div className="flex flex-col items-center justify-center">
                    <Upload className="h-5 w-5 text-muted-foreground mb-2"/>
                    <span className="text-sm text-muted-foreground">Click to upload</span>
                  </div>
                </Label>
                <Input
                  id="screenshot-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleScreenshotUpload}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Enter the product details to track your profit.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="productName"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Product Name" {...field} />
                      </FormControl>
                      <FormDescription>Enter the name of the product.</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pricePaid"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Price Paid</FormLabel>
                      <FormControl>
                        <Input placeholder="Price Paid" {...field} />
                      </FormControl>
                      <FormDescription>Enter the price you paid for the product.</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="quantityPurchased"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Quantity Purchased</FormLabel>
                      <FormControl>
                        <Input placeholder="Quantity Purchased" {...field} />
                      </FormControl>
                      <FormDescription>Enter the quantity of the product purchased.</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="originalQuantityPurchased"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Original Quantity Purchased</FormLabel>
                      <FormControl>
                        <Input placeholder="Original Quantity Purchased" {...field} />
                      </FormControl>
                      <FormDescription>Enter the quantity of the product purchased.</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Cost Price (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Cost Price" {...field} />
                      </FormControl>
                      <FormDescription>Enter the cost price of the product if available.</FormDescription>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="productImage"
                  render={({field}) => (
                    <FormItem>
                      <FormLabel>Product Image (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Product Image URL" {...field} readOnly />
                      </FormControl>
                      <FormDescription>Product Image.</FormDescription>
                    </FormItem>
                  )}
                />
                <Button type="submit">Add Product</Button>
              </form>
            </Form>
            <Button className="mt-4" onClick={calculateSuggestedPrice}>
              Calculate Suggested Selling Price
            </Button>
            {suggestedSellingPrice !== null && (
              <div className="mt-4">
                <p className="text-lg font-semibold">
                  Suggested Selling Price: ${suggestedSellingPrice.toFixed(2)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
