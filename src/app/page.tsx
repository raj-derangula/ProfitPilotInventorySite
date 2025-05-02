"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {extractProductDetails} from "@/ai/flows/extract-product-details";
import {MarketTrendData, getMarketTrendData} from "@/services/market-trends";
import {Upload, X, Image as ImageIcon, DollarSign} from "lucide-react"; // Added ImageIcon, DollarSign
import {FormField, FormItem, FormLabel, FormControl, FormDescription, Form} from "@/components/ui/form"; // Removed useFormField as it's auto-imported via useFormField hook
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useRouter} from "next/navigation";
import Image from 'next/image'; // Import next/image

const productDetailsSchema = z.object({
  productName: z.string().min(2, {
    message: "Product name must be at least 2 characters.",
  }),
  pricePaid: z.string().refine((value) => {
    try {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0; // Allow 0 or greater
    } catch (e) {
      return false;
    }
  }, {
    message: "Price paid must be a valid number.",
  }),
  quantity: z.string().refine((value) => {
    try {
      const num = parseInt(value, 10);
      return !isNaN(num) && num > 0;
    } catch (e) {
      return false;
    }
  }, {
    message: "Quantity must be a valid integer greater than zero.",
  }),
  originalQuantityPurchased: z.string().refine((value) => {
    try {
      const num = parseInt(value, 10);
      return !isNaN(num) && num > 0;
    } catch (e) {
      return false;
    }
  }, {
    message: "Original quantity must be a valid integer greater than zero.",
  }),
  costPrice: z.string().optional().refine((value) => {
     if (value === undefined || value === "") return true; // Optional is allowed
    try {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0; // Allow 0 or greater
    } catch (e) {
      return false;
    }
  }, {
      message: "Cost price must be a valid number if provided.",
  }),
  productImage: z.string().optional(),
});

interface ProductDetailsFormValues extends z.infer<typeof productDetailsSchema> {}

export default function Home() {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [suggestedSellingPrice, setSuggestedSellingPrice] = useState<number | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const {toast} = useToast();
  const router = useRouter();

  const form = useForm<ProductDetailsFormValues>({
    resolver: zodResolver(productDetailsSchema),
    defaultValues: {
      productName: "",
      pricePaid: "",
      quantity: "",
      originalQuantityPurchased: "",
      costPrice: "",
      productImage: "",
    },
  });

  useEffect(() => {
    // Function to safely parse JSON from local storage
    const safelyParseJSON = (key: string) => {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
            try {
                return JSON.parse(storedValue);
            } catch (e) {
                console.error(`Error parsing JSON from localStorage key "${key}":`, e);
                localStorage.removeItem(key); // Remove invalid data
            }
        }
        return null; // Return null if not found or invalid
    };

    // Load product details from local storage on component mount
    safelyParseJSON("productDetails");
    safelyParseJSON("purchasedProducts");
  }, []);


  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsLoadingAI(true); // Start loading indicator for AI extraction
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUri = reader.result as string;
      setScreenshot(dataUri);
      form.setValue("productImage", dataUri);

      try {
        const productDetails = await extractProductDetails({screenshotDataUri: dataUri});
        form.setValue("productName", productDetails.productName);
        form.setValue("pricePaid", productDetails.pricePaid.toString());
        // Ensure quantity is at least 1
        const quantity = Math.max(1, productDetails.quantityPurchased);
        form.setValue("quantity", quantity.toString());
        form.setValue("originalQuantityPurchased", quantity.toString());

        toast({
          title: "🤖 Product details extracted!",
          description: `Product: ${productDetails.productName}, Price: $${productDetails.pricePaid}, Qty: ${quantity}`,
        });
      } catch (error: any) {
        console.error("Error extracting product details:", error);
        toast({
          variant: "destructive",
          title: "AI Extraction Error",
          description: error.message || "Failed to extract details from screenshot.",
        });
         // Reset relevant fields on error
         handleRemoveScreenshot(false); // Don't show toast on internal reset
      } finally {
        setIsLoadingAI(false); // Stop loading indicator
      }
    };
    reader.readAsDataURL(file);
  };

  const calculateSuggestedPrice = async () => {
    const productName = form.getValues("productName");
    if (!productName) {
         toast({
            variant: "destructive",
            title: "Missing Product Name",
            description: "Please enter a product name first.",
         });
         return;
    }

    setIsLoadingPrice(true); // Start loading indicator for price calculation
    try {
      const marketTrendData: MarketTrendData = await getMarketTrendData(productName);
      // Suggest 20% above average, ensuring it's not negative
      const suggestedPrice = Math.max(0, marketTrendData.averagePrice * 1.2);
      setSuggestedSellingPrice(suggestedPrice);
      toast({
        title: "📈 Suggested Selling Price",
        description: `Based on market trends, $${suggestedPrice.toFixed(2)} is suggested.`,
      });
    } catch (error: any) {
      console.error("Error calculating suggested price:", error);
      setSuggestedSellingPrice(null); // Reset on error
      toast({
        variant: "destructive",
        title: "Price Calculation Error",
        description: error.message || "Failed to calculate suggested price.",
      });
    } finally {
        setIsLoadingPrice(false); // Stop loading indicator
    }
  };

 const onSubmit = (values: ProductDetailsFormValues) => {
    // Retrieve existing product details safely
    const getStoredProducts = (key: string): ProductDetailsFormValues[] => {
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Basic validation: check if it's an array
                if (Array.isArray(parsed)) {
                    // Optional: Further validate each item shape if needed
                    return parsed;
                }
            } catch (e) {
                console.error(`Error parsing localStorage key "${key}":`, e);
            }
        }
        // If not found, invalid, or not an array, return empty array
        localStorage.removeItem(key); // Clean up invalid data
        return [];
    };

    const existingProducts = getStoredProducts("productDetails");
    const existingPurchasedProducts = getStoredProducts("purchasedProducts");

    // Prepare the new product data
    const newProductData = {
        ...values,
        productImage: screenshot || `https://picsum.photos/seed/${encodeURIComponent(values.productName)}/400/300`, // Use screenshot or fallback
        // Ensure quantities are strings as per schema, though stored as numbers potentially
        quantity: String(values.quantity),
        originalQuantityPurchased: String(values.originalQuantityPurchased),
        pricePaid: String(values.pricePaid),
        costPrice: values.costPrice ? String(values.costPrice) : undefined,
    };

    // Add the new product to the lists
    const updatedProducts = [...existingProducts, newProductData];
    const updatedPurchasedProducts = [...existingPurchasedProducts, newProductData];

    // Filter out products with quantity equal to 0 for the main inventory
    const filteredProducts = updatedProducts.filter(product => parseInt(product.quantity, 10) > 0);

    // Store the updated lists in local storage
    localStorage.setItem("productDetails", JSON.stringify(filteredProducts));
    localStorage.setItem("purchasedProducts", JSON.stringify(updatedPurchasedProducts)); // Store all purchases

    toast({
      title: "✅ Product Added!",
      description: `${values.productName} (${values.quantity}) added to inventory.`,
    });

    // Reset form and state *after* successful storage
    form.reset(); // Reset form to default values
    setScreenshot(null);
    setSuggestedSellingPrice(null);

    router.push("/inventory"); // Redirect to inventory page after submission
};


    const handleRemoveScreenshot = (showToast = true) => {
        setScreenshot(null);
        // Reset AI-derived fields and image
        form.resetField("productName");
        form.resetField("pricePaid");
        form.resetField("quantity");
        form.resetField("originalQuantityPurchased");
        form.setValue("productImage", ""); // Explicitly clear image
        if (showToast) {
            toast({
                title: "Screenshot Removed",
                description: "Product details cleared.",
            });
        }
    };

  const handleChangeScreenshot = () => {
    const fileInput = document.getElementById("screenshot-upload") as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10 px-4">
      <h1 className="page-title">Add New Product</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
         {/* Screenshot Upload Card */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <Upload className="h-5 w-5 text-primary" />
              Upload Order Screenshot
            </CardTitle>
            <CardDescription>Let AI extract product details automatically. (Optional)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 min-h-[250px] relative">
            {isLoadingAI && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-b-lg">
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-8 w-8 text-primary mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-muted-foreground">Extracting details...</p>
                 </div>
              </div>
            )}
            {screenshot ? (
              <div className="relative w-full aspect-video mb-4 group">
                <Image
                  src={screenshot}
                  alt="Order Confirmation Screenshot"
                  layout="fill"
                  objectFit="contain"
                  className="rounded-md"
                />
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemoveScreenshot()}
                    aria-label="Remove Screenshot"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleChangeScreenshot}
                    aria-label="Change Screenshot"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Label
                htmlFor="screenshot-upload"
                className="cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors duration-200 rounded-lg p-8 flex flex-col items-center justify-center w-full text-center"
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <span className="text-sm font-medium text-foreground">Click or Drag to Upload</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 10MB</span>
              </Label>
            )}
            <Input
              id="screenshot-upload"
              type="file"
              accept="image/png, image/jpeg, image/gif"
              className="hidden"
              onChange={handleScreenshotUpload}
              disabled={isLoadingAI}
            />
          </CardContent>
        </Card>

        {/* Product Details Form Card */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <ImageIcon className="h-5 w-5 text-primary"/>
              Product Details
            </CardTitle>
            <CardDescription>Enter or verify the product details below.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                    control={form.control}
                    name="productName"
                    render={({field}) => (
                        <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., T-Shirt, Coffee Mug" {...field} className="input"/>
                        </FormControl>
                        <FormDescription className="text-xs">The name of the item.</FormDescription>
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="quantity"
                    render={({field}) => (
                        <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                            <Input type="number" placeholder="e.g., 10" {...field} className="input" min="1"/>
                        </FormControl>
                         <FormDescription className="text-xs">How many units?</FormDescription>
                        </FormItem>
                    )}
                    />
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <FormField
                    control={form.control}
                    name="pricePaid"
                    render={({field}) => (
                        <FormItem>
                        <FormLabel>Total Price Paid</FormLabel>
                         <FormControl>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                <Input type="number" placeholder="e.g., 19.99" {...field} className="input pl-8" step="0.01" min="0"/>
                            </div>
                        </FormControl>
                        <FormDescription className="text-xs">Total cost for the quantity entered.</FormDescription>
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="costPrice"
                    render={({field}) => (
                        <FormItem>
                        <FormLabel>Cost Price (Unit)</FormLabel>
                         <FormControl>
                             <div className="relative">
                                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                <Input type="number" placeholder="Optional" {...field} className="input pl-8" step="0.01" min="0"/>
                            </div>
                        </FormControl>
                        <FormDescription className="text-xs">Cost per single item (if different).</FormDescription>
                        </FormItem>
                    )}
                    />
                </div>

                {/* Hidden Original Quantity Field - automatically set */}
                <FormField
                  control={form.control}
                  name="originalQuantityPurchased"
                  render={({field}) => ( <FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl></FormItem> )}
                />
                 {/* Hidden Product Image Field - automatically set */}
                 <FormField
                  control={form.control}
                  name="productImage"
                  render={({field}) => ( <FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl></FormItem> )}
                 />

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button type="submit" className="flex-1 btn-primary" disabled={isLoadingAI || isLoadingPrice}>
                    Add Product to Inventory
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={calculateSuggestedPrice} disabled={isLoadingPrice || isLoadingAI}>
                     {isLoadingPrice ? (
                         <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Calculating...
                         </>
                     ) : (
                         "Calculate Suggested Price"
                     )}
                  </Button>
                </div>
              </form>
            </Form>

            {suggestedSellingPrice !== null && (
              <div className="mt-6 p-4 bg-accent/50 border border-accent rounded-lg text-center">
                <p className="text-sm font-medium text-accent-foreground">
                  Suggested Selling Price: <span className="font-bold text-lg">${suggestedSellingPrice.toFixed(2)}</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
