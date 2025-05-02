"use client";

import {useState, useEffect, useRef} from "react"; // Added useRef
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {extractProductDetails} from "@/ai/flows/extract-product-details";
import {MarketTrendData, getMarketTrendData} from "@/services/market-trends";
import {Upload, X, Image as ImageIcon, DollarSign, Loader2} from "lucide-react"; // Added Loader2
import {FormField, FormItem, FormLabel, FormControl, FormDescription, Form} from "@/components/ui/form";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useRouter} from "next/navigation";
import Image from 'next/image';
import { cn } from "@/lib/utils"; // Import cn

// Define the shape of the product data stored in localStorage
interface StoredProductDetails {
  productName: string;
  pricePaid: string; // Total price for original quantity
  quantity: string; // Current stock or final quantity in archive
  originalQuantityPurchased: string;
  costPrice?: string; // Unit cost
  productImage?: string;
}

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
     // Original quantity should match the current quantity when adding initially
     // This validation logic might be redundant if set programmatically
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
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null); // Preview for the *last* uploaded image
  const [suggestedSellingPrice, setSuggestedSellingPrice] = useState<number | null>(null);
  const [isProcessingUploads, setIsProcessingUploads] = useState(false); // Loading state for multiple uploads
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const {toast} = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input

  const form = useForm<ProductDetailsFormValues>({
    resolver: zodResolver(productDetailsSchema),
    defaultValues: {
      productName: "",
      pricePaid: "",
      quantity: "",
      originalQuantityPurchased: "", // Will be set same as quantity initially
      costPrice: "",
      productImage: "",
    },
  });

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

    // Helper function to add a single product to inventory and archive
    const addProductToInventory = (productData: ProductDetailsFormValues) => {
        const existingProducts = safelyParseJSON("productDetails");
        const existingPurchasedProducts = safelyParseJSON("purchasedProducts");

        // Prepare the new product data, ensuring quantities are consistent
        const newProduct: StoredProductDetails = {
            ...productData,
            productImage: productData.productImage || `https://picsum.photos/seed/${encodeURIComponent(productData.productName)}/400/300`,
            originalQuantityPurchased: productData.quantity, // Set original quantity same as current quantity on initial add
            // Ensure quantities are strings as per schema
            quantity: String(productData.quantity),
            pricePaid: String(productData.pricePaid),
            costPrice: productData.costPrice ? String(productData.costPrice) : undefined,
        };

        // Add the new product to the lists
        const updatedProducts = [...existingProducts, newProduct];
        const updatedPurchasedProducts = [...existingPurchasedProducts, newProduct];

        // Filter out products with quantity equal to 0 for the main inventory (though initial add should be > 0)
        const filteredProducts = updatedProducts.filter(product => parseInt(product.quantity, 10) > 0);

        // Store the updated lists in local storage
        localStorage.setItem("productDetails", JSON.stringify(filteredProducts));
        localStorage.setItem("purchasedProducts", JSON.stringify(updatedPurchasedProducts)); // Store all purchases

        toast({
            title: "✅ Product Added!",
            description: `${productData.productName} (${productData.quantity}) added to inventory.`,
        });
    };


  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsProcessingUploads(true); // Start loading indicator
    setScreenshotPreview(null); // Clear previous preview

    let lastDataUri: string | null = null;
    let successCount = 0;
    let errorCount = 0;

    for (const file of Array.from(files)) { // Iterate through all selected files
      const reader = new FileReader();
      try {
          const dataUri = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

        lastDataUri = dataUri; // Store data URI for potential preview
        setScreenshotPreview(dataUri); // Update preview for the current file being processed

        const productDetails = await extractProductDetails({ screenshotDataUri: dataUri });

        // Ensure quantity is at least 1
        const quantity = Math.max(1, productDetails.quantityPurchased);

        // Prepare data for adding to inventory
        const productData: ProductDetailsFormValues = {
            productName: productDetails.productName,
            pricePaid: productDetails.pricePaid.toString(),
            quantity: quantity.toString(),
            originalQuantityPurchased: quantity.toString(), // Set original quantity
            costPrice: "", // AI doesn't extract costPrice, leave empty or maybe calculate later
            productImage: dataUri, // Use the actual screenshot
        };

        // Add the extracted product to inventory
        addProductToInventory(productData);
        successCount++;

      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        toast({
          variant: "destructive",
          title: `AI Extraction Error (${file.name})`,
          description: error.message || "Failed to extract details from screenshot.",
        });
        errorCount++;
      }
    }

    // Reset file input value to allow re-uploading the same file(s)
     if (fileInputRef.current) {
        fileInputRef.current.value = '';
     }

    setIsProcessingUploads(false); // Stop loading indicator

    // Final toast summarizing the batch upload
     toast({
        title: "Screenshot Processing Complete",
        description: `${successCount} product(s) added successfully, ${errorCount} failed.`,
        variant: errorCount > 0 && successCount === 0 ? "destructive" : "default",
     });

     // Optionally reset the form if needed, or keep for manual entry
     // form.reset();
     // setScreenshotPreview(null); // Clear preview after all processing is done
     setSuggestedSellingPrice(null);

      // Redirect only if at least one product was added successfully
      if (successCount > 0) {
         // Debounce redirect slightly to allow toasts to be seen
         setTimeout(() => router.push("/inventory"), 1000);
      }
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

 // Handles manual form submission
 const onSubmit = (values: ProductDetailsFormValues) => {
    // Set originalQuantityPurchased same as quantity for manual add
    const dataToAdd = { ...values, originalQuantityPurchased: values.quantity };
    addProductToInventory(dataToAdd);

    // Reset form and state *after* successful storage
    form.reset(); // Reset form to default values
    setScreenshotPreview(null);
    setSuggestedSellingPrice(null);

    router.push("/inventory"); // Redirect to inventory page after submission
};


    const handleRemoveScreenshotPreview = (showToast = true) => {
        setScreenshotPreview(null);
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        // Optionally reset parts of the form if the preview was tied to auto-filled data
         // form.resetField("productImage"); // May not be needed if productImage isn't explicitly set by preview
        if (showToast) {
            toast({
                title: "Screenshot Preview Removed",
                description: "Ready for new upload or manual entry.",
            });
        }
    };

  const handleChangeScreenshot = () => {
    // Trigger click on the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
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
              Upload Order Screenshot(s)
            </CardTitle>
            <CardDescription>Let AI extract product details. You can upload multiple files.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 min-h-[250px] relative">
            {isProcessingUploads && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10 rounded-b-lg">
                <div className="flex flex-col items-center">
                   <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
                  <p className="text-muted-foreground">Processing uploads...</p>
                 </div>
              </div>
            )}
            {screenshotPreview ? (
              <div className="relative w-full aspect-video mb-4 group">
                <Image
                  src={screenshotPreview}
                  alt="Last Uploaded Screenshot Preview"
                  layout="fill"
                  objectFit="contain"
                  className="rounded-md"
                  data-ai-hint="order screenshot"
                />
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleRemoveScreenshotPreview()}
                    aria-label="Remove Screenshot Preview"
                    disabled={isProcessingUploads}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleChangeScreenshot}
                    aria-label="Change Screenshot(s)"
                     disabled={isProcessingUploads}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Label
                htmlFor="screenshot-upload"
                className={cn(
                  "cursor-pointer border-2 border-dashed border-border hover:border-primary transition-colors duration-200 rounded-lg p-8 flex flex-col items-center justify-center w-full text-center",
                   isProcessingUploads && "cursor-not-allowed opacity-50" // Style when loading
                )}
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <span className="text-sm font-medium text-foreground">Click or Drag to Upload</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 10MB (Multiple allowed)</span>
              </Label>
            )}
            <Input
              id="screenshot-upload"
              type="file"
              accept="image/png, image/jpeg, image/gif"
              className="hidden"
              onChange={handleScreenshotUpload}
              disabled={isProcessingUploads}
              multiple // Allow multiple file selection
              ref={fileInputRef} // Assign ref
            />
             {screenshotPreview && !isProcessingUploads && (
               <p className="text-xs text-muted-foreground mt-2 text-center">Showing preview of the last uploaded image. Add more or proceed to manual entry.</p>
             )}
          </CardContent>
        </Card>

        {/* Product Details Form Card (Manual Entry) */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <ImageIcon className="h-5 w-5 text-primary"/>
              Manual Product Entry
            </CardTitle>
            <CardDescription>Enter product details manually if not using AI extraction.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              {/* Disable form while uploads are processing */}
              <fieldset disabled={isProcessingUploads}>
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
                        {form.formState.errors.productName && <p className="text-destructive text-xs mt-1">{form.formState.errors.productName.message}</p>}
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
                          {form.formState.errors.quantity && <p className="text-destructive text-xs mt-1">{form.formState.errors.quantity.message}</p>}
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
                         {form.formState.errors.pricePaid && <p className="text-destructive text-xs mt-1">{form.formState.errors.pricePaid.message}</p>}
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
                         {form.formState.errors.costPrice && <p className="text-destructive text-xs mt-1">{form.formState.errors.costPrice.message}</p>}
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
                 {/* Hidden Product Image Field - set manually or via screenshot */}
                 <FormField
                  control={form.control}
                  name="productImage"
                  render={({field}) => (
                       <FormItem className="hidden">
                         {/* Optionally add a visible input if manual image URL entry is desired */}
                          {/* <FormLabel>Product Image URL</FormLabel> */}
                         <FormControl><Input type="hidden" {...field} /></FormControl>
                         {/* <FormDescription className="text-xs">URL of the product image.</FormDescription> */}
                       </FormItem>
                 )}
                 />

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button type="submit" className="flex-1 btn-primary" disabled={isProcessingUploads || isLoadingPrice}>
                    {isProcessingUploads ? 'Processing...' : 'Add Product Manually'}
                  </Button>
                  <Button type="button" variant="outline" className="flex-1" onClick={calculateSuggestedPrice} disabled={isLoadingPrice || isProcessingUploads}>
                     {isLoadingPrice ? (
                         <>
                            <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                            Calculating...
                         </>
                     ) : (
                         "Calculate Suggested Price"
                     )}
                  </Button>
                </div>
              </form>
            </fieldset> {/* End fieldset */}
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
