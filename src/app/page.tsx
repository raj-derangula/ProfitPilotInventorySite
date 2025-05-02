"use client";

import {useState, useEffect, useRef} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Checkbox} from "@/components/ui/checkbox"; // Import Checkbox
import {useToast} from "@/hooks/use-toast";
import {extractProductDetails} from "@/ai/flows/extract-product-details";
import {MarketTrendData, getMarketTrendData} from "@/services/market-trends";
import {Upload, X, Image as ImageIcon, DollarSign, Loader2, CheckCircle, XCircle, Edit} from "lucide-react"; // Added Edit icon
import {FormField, FormItem, FormLabel, FormControl, FormDescription, Form} from "@/components/ui/form";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useRouter} from "next/navigation";
import Image from 'next/image';
import { cn } from "@/lib/utils";

// Define the shape of the product data stored in localStorage
interface StoredProductDetails {
  productName: string;
  pricePaid: string; // Total price for original quantity
  quantity: string; // Current stock or final quantity in archive
  originalQuantityPurchased: string;
  costPrice?: string; // Unit cost
  productImage?: string;
}

// Schema for the main form and pending products
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

// Separate interface for pending products state to handle edits
interface PendingProduct extends ProductDetailsFormValues {
    screenshotDataUri?: string; // Keep the original full screenshot for reference
    // productImage field from ProductDetailsFormValues will hold the current image (original screenshot or user-uploaded)
}

export default function Home() {
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null); // Preview for the *last* uploaded screenshot
  const [suggestedSellingPrice, setSuggestedSellingPrice] = useState<number | null>(null);
  const [isProcessingUploads, setIsProcessingUploads] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false); // State for approval checkbox
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]); // State for pending products
  const {toast} = useToast();
  const router = useRouter();
  const screenshotFileInputRef = useRef<HTMLInputElement>(null); // Ref for screenshot input
  const pendingProductImageInputRef = useRef<HTMLInputElement>(null); // Ref for pending product image input
  const [pendingProductImageIndex, setPendingProductImageIndex] = useState<number | null>(null); // Index of pending product to update image for

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

   // Function to safely parse JSON from local storage
    const safelyParseJSON = (key: string): StoredProductDetails[] => {
        const storedValue = localStorage.getItem(key);
        if (storedValue) {
            try {
                const parsed = JSON.parse(storedValue);
                if (Array.isArray(parsed)) {
                    return parsed;
                }
                console.warn(`Data for key "${key}" is not an array, clearing.`);
            } catch (e) {
                console.error(`Error parsing JSON from localStorage key "${key}":`, e);
            }
            localStorage.removeItem(key);
        }
        return [];
    };

    // Helper function to add a single product to inventory and archive
    const addProductToInventory = (productData: ProductDetailsFormValues) => {
        const existingProducts = safelyParseJSON("productDetails");
        const existingPurchasedProducts = safelyParseJSON("purchasedProducts");

        // Use explicitly provided image first, otherwise generate placeholder
        const imageToUse = productData.productImage || `https://picsum.photos/seed/${encodeURIComponent(productData.productName)}/400/300`;

        const newProduct: StoredProductDetails = {
            productName: productData.productName,
            pricePaid: String(productData.pricePaid),
            quantity: String(productData.quantity), // Set current quantity
            originalQuantityPurchased: productData.originalQuantityPurchased, // Use the passed original quantity
            costPrice: productData.costPrice ? String(productData.costPrice) : undefined,
            productImage: imageToUse, // Use the determined image
        };


        // Check if product already exists in 'purchasedProducts' (archive)
        const existingArchiveIndex = existingPurchasedProducts.findIndex(p => p.productName === newProduct.productName);

        let updatedPurchasedProducts;
        if (existingArchiveIndex > -1) {
            // Update existing entry in archive
            updatedPurchasedProducts = [...existingPurchasedProducts];
            const existingArchived = updatedPurchasedProducts[existingArchiveIndex];
            const oldTotalPaid = parseFloat(existingArchived.pricePaid) || 0;
            const oldOriginalQty = parseInt(existingArchived.originalQuantityPurchased, 10) || 0;
            const oldCurrentQty = parseInt(existingArchived.quantity, 10) || 0;

            const newTotalPaid = parseFloat(newProduct.pricePaid) || 0;
            const newOriginalQty = parseInt(newProduct.originalQuantityPurchased, 10) || 0;

            existingArchived.pricePaid = (oldTotalPaid + newTotalPaid).toFixed(2); // Add total prices
            existingArchived.originalQuantityPurchased = (oldOriginalQty + newOriginalQty).toString(); // Add original quantities
            existingArchived.quantity = (oldCurrentQty + newOriginalQty).toString(); // Add to current quantity in archive
            // Keep existing costPrice or update if new one provided? - Let's keep existing for simplicity
            existingArchived.productImage = newProduct.productImage; // Update image if needed
        } else {
            // Add as new entry to archive
            updatedPurchasedProducts = [...existingPurchasedProducts, newProduct];
        }

         // Check if product already exists in 'productDetails' (current inventory)
         const existingInventoryIndex = existingProducts.findIndex(p => p.productName === newProduct.productName);
         let updatedProducts;
         if(existingInventoryIndex > -1) {
            // Update existing entry in inventory
             updatedProducts = [...existingProducts];
             const existingInv = updatedProducts[existingInventoryIndex];
             const oldInvQty = parseInt(existingInv.quantity, 10) || 0;
             const newInvQty = parseInt(newProduct.quantity, 10) || 0;
             const oldInvOriginalQty = parseInt(existingInv.originalQuantityPurchased, 10) || 0;
             const newInvOriginalQty = parseInt(newProduct.originalQuantityPurchased, 10) || 0;
             const oldInvTotalPaid = parseFloat(existingInv.pricePaid) || 0;
             const newInvTotalPaid = parseFloat(newProduct.pricePaid) || 0;

             existingInv.quantity = (oldInvQty + newInvQty).toString();
             // Update original qty and price paid to reflect the *combined* purchase for unit price calculation later
             existingInv.originalQuantityPurchased = (oldInvOriginalQty + newInvOriginalQty).toString();
             existingInv.pricePaid = (oldInvTotalPaid + newInvTotalPaid).toFixed(2);
             // Keep existing costPrice or update if new one provided? - Let's keep existing
             existingInv.productImage = newProduct.productImage; // Update image
         } else {
            // Add as new entry to inventory
             updatedProducts = [...existingProducts, newProduct];
         }


        // Filter out 0 quantity items AFTER adding/updating
        const filteredProducts = updatedProducts.filter(product => parseInt(product.quantity, 10) > 0);

        localStorage.setItem("productDetails", JSON.stringify(filteredProducts));
        localStorage.setItem("purchasedProducts", JSON.stringify(updatedPurchasedProducts));

        toast({
            title: "✅ Product Added/Updated!",
            description: `${productData.productName} (${productData.quantity}) added/updated in inventory.`,
        });
    };


  const handleScreenshotUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setIsProcessingUploads(true);
    setScreenshotPreview(null); // Clear preview initially

    let lastDataUri: string | null = null;
    let successCount = 0;
    let errorCount = 0;
    let pendingCount = 0;
    const newlyPendingProducts: PendingProduct[] = [];

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      try {
          const dataUri = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

        lastDataUri = dataUri; // Keep track of the last successful read for preview
        setScreenshotPreview(dataUri); // Preview current file being processed

        const productDetails = await extractProductDetails({ screenshotDataUri: dataUri });
        const quantity = Math.max(1, productDetails.quantityPurchased);

        // Use the full screenshot data URI as the initial productImage
        const productData: PendingProduct = {
            productName: productDetails.productName,
            pricePaid: productDetails.pricePaid.toString(),
            quantity: quantity.toString(),
            originalQuantityPurchased: quantity.toString(), // Set original quantity from AI
            costPrice: "", // Default cost price
            productImage: dataUri, // Use screenshot as initial image
            screenshotDataUri: dataUri, // Keep original screenshot for reference
        };

        // Check if approval is required
        if (requireApproval) {
            newlyPendingProducts.push(productData); // Add to temporary list for this batch
            pendingCount++;
        } else {
            // Directly add to inventory, passing necessary fields
             addProductToInventory({
                 productName: productData.productName,
                 pricePaid: productData.pricePaid,
                 quantity: productData.quantity,
                 originalQuantityPurchased: productData.originalQuantityPurchased, // Pass original qty
                 costPrice: productData.costPrice,
                 productImage: productData.productImage, // Pass the screenshot image
             });
            successCount++;
        }

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

     if (screenshotFileInputRef.current) {
        screenshotFileInputRef.current.value = ''; // Clear the file input after processing
     }

    setIsProcessingUploads(false);

    // Add newly pending products to the main state
    if (newlyPendingProducts.length > 0) {
        setPendingProducts(prev => [...prev, ...newlyPendingProducts]);
    }

     // Updated summary toast
     let description = "";
     if (successCount > 0) description += `${successCount} product(s) added/updated directly. `;
     if (pendingCount > 0) description += `${pendingCount} product(s) pending approval. `;
     if (errorCount > 0) description += `${errorCount} failed.`;

     toast({
        title: "Screenshot Processing Complete",
        description: description.trim(),
        variant: errorCount > 0 && successCount === 0 && pendingCount === 0 ? "destructive" : "default",
     });

     setSuggestedSellingPrice(null);

      // Redirect only if products were added directly AND no products are pending now
      if (successCount > 0 && pendingProducts.length === 0 && newlyPendingProducts.length === 0) {
         setTimeout(() => router.push("/inventory"), 1000);
      } else if (newlyPendingProducts.length > 0) {
        // Don't redirect, show pending section
      } else if (errorCount > 0 && successCount === 0 && pendingCount === 0) {
        // Don't redirect on total failure
      } else if (successCount > 0 && pendingProducts.length > 0) {
         // Added some directly, but others are pending, don't redirect
         toast({
            title: "Products Added & Pending",
            description: "Some products added/updated, others require review below.",
         });
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

    setIsLoadingPrice(true);
    try {
      const marketTrendData: MarketTrendData = await getMarketTrendData(productName);
      const suggestedPrice = Math.max(0, marketTrendData.averagePrice * 1.2);
      setSuggestedSellingPrice(suggestedPrice);
      toast({
        title: "📈 Suggested Selling Price",
        description: `Based on market trends, $${suggestedPrice.toFixed(2)} is suggested.`,
      });
    } catch (error: any) {
      console.error("Error calculating suggested price:", error);
      setSuggestedSellingPrice(null);
      toast({
        variant: "destructive",
        title: "Price Calculation Error",
        description: error.message || "Failed to calculate suggested price.",
      });
    } finally {
        setIsLoadingPrice(false);
    }
  };

 const onSubmit = (values: ProductDetailsFormValues) => {
    // Manual submission doesn't have a specific image unless we add an input later
    // For now, it will use the placeholder in addProductToInventory if productImage is empty
    const dataToAdd = {
        ...values,
        // For manual add, original quantity IS the quantity entered initially
        originalQuantityPurchased: values.quantity,
        // Pass productImage value (could be empty string, handled by addProductToInventory)
        productImage: values.productImage || "",
    };
    addProductToInventory(dataToAdd);

    form.reset(); // Reset manual form
    setScreenshotPreview(null); // Clear any screenshot preview
    setSuggestedSellingPrice(null);

    // Only redirect if no products are pending approval
    if (pendingProducts.length === 0) {
        router.push("/inventory");
    } else {
         toast({
            title: "Manual Product Added/Updated",
            description: "There are still products pending approval from screenshot uploads.",
         });
    }
};

    const handleRemoveScreenshotPreview = (showToast = true) => {
        setScreenshotPreview(null);
        if (screenshotFileInputRef.current) {
            screenshotFileInputRef.current.value = '';
        }
        if (showToast) {
            toast({
                title: "Screenshot Preview Removed",
                description: "Ready for new upload or manual entry.",
            });
        }
    };

  const handleChangeScreenshot = () => {
    if (screenshotFileInputRef.current) {
      screenshotFileInputRef.current.click();
    }
  };

   // --- Pending Product Handlers ---

    const handlePendingProductChange = (index: number, field: keyof PendingProduct, value: string) => {
        setPendingProducts(prev => {
            const updated = [...prev];
            if (updated[index]) {
                // @ts-ignore - Ignore type checking for dynamic field update
                updated[index][field] = value;
                 // If quantity changes, update originalQuantityPurchased to match for pending items
                 if (field === 'quantity') {
                    updated[index].originalQuantityPurchased = value;
                 }
            }
            return updated;
        });
    };

    // Trigger file input for a specific pending product
    const handleEditPendingProductImage = (index: number) => {
        setPendingProductImageIndex(index);
        if (pendingProductImageInputRef.current) {
            pendingProductImageInputRef.current.click();
        }
    };

     // Handle the file selection for pending product image
    const handlePendingProductImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || pendingProductImageIndex === null) {
            return;
        }

        const reader = new FileReader();
        try {
            const dataUri = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Update the specific pending product's productImage
            setPendingProducts(prev => {
                const updated = [...prev];
                if (updated[pendingProductImageIndex]) {
                    updated[pendingProductImageIndex].productImage = dataUri;
                }
                return updated;
            });

            toast({
                title: "Image Updated",
                description: `Image for ${pendingProducts[pendingProductImageIndex].productName} updated. Click Approve to save.`,
            });

        } catch (error) {
            console.error("Error reading product image file:", error);
            toast({
                variant: "destructive",
                title: "Image Upload Error",
                description: "Failed to read the selected image file.",
            });
        } finally {
             // Reset the input and index
            if (pendingProductImageInputRef.current) {
                pendingProductImageInputRef.current.value = '';
            }
            setPendingProductImageIndex(null);
        }
    };


    const handleApprovePendingProduct = (index: number) => {
        const productToApprove = pendingProducts[index];
        if (!productToApprove) return;

        // Basic validation before approving
         const quantityNum = parseInt(productToApprove.quantity, 10);
         const priceNum = parseFloat(productToApprove.pricePaid);

        if (!productToApprove.productName.trim() || isNaN(priceNum) || priceNum < 0 || isNaN(quantityNum) || quantityNum <= 0) {
             toast({
                variant: "destructive",
                title: "Invalid Data",
                description: "Cannot approve product with invalid name, price, or quantity.",
             });
             return;
        }

        // Ensure original quantity matches current quantity on approval if not edited separately
        // The productToApprove already holds the potentially edited values
        const dataToInventory: ProductDetailsFormValues = {
            productName: productToApprove.productName,
            pricePaid: productToApprove.pricePaid,
            quantity: productToApprove.quantity,
            originalQuantityPurchased: productToApprove.originalQuantityPurchased, // Use the value from pending state
            costPrice: productToApprove.costPrice,
            productImage: productToApprove.productImage, // Pass the final image (screenshot or uploaded)
        };

        addProductToInventory(dataToInventory); // Add/Update the product

        // Remove from pending list
        setPendingProducts(prev => prev.filter((_, i) => i !== index));

        // Redirect if this was the last pending product
         if (pendingProducts.length === 1) {
            router.push("/inventory");
         }
    };

    const handleDiscardPendingProduct = (index: number) => {
        const productToDiscard = pendingProducts[index];
         if (!productToDiscard) return;

        setPendingProducts(prev => prev.filter((_, i) => i !== index));
        toast({
            title: "Product Discarded",
            description: `${productToDiscard.productName || 'Pending product'} was removed from the pending list.`,
            variant: "destructive",
        });
    };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10 px-4 space-y-8">
      <h1 className="page-title">Add New Product</h1>

       {/* Upload and Manual Entry Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-6xl">
         {/* Screenshot Upload Card */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 card"> {/* Added card class */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <Upload className="h-5 w-5 text-primary" />
              Upload Order Screenshot(s)
            </CardTitle>
            <CardDescription>Let AI extract product details. You can upload multiple files.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 min-h-[300px] relative">
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
                    className="h-8 w-8 btn" // Added btn class
                    onClick={() => handleRemoveScreenshotPreview()}
                    aria-label="Remove Screenshot Preview"
                    disabled={isProcessingUploads}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 btn" // Added btn class
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
                   isProcessingUploads && "cursor-not-allowed opacity-50"
                )}
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <span className="text-sm font-medium text-foreground">Click or Drag to Upload</span>
                <span className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF (Multiple allowed)</span>
              </Label>
            )}
            <Input
              id="screenshot-upload"
              type="file"
              accept="image/png, image/jpeg, image/gif"
              className="hidden"
              onChange={handleScreenshotUpload}
              disabled={isProcessingUploads}
              multiple
              ref={screenshotFileInputRef} // Use the ref here
            />
             {screenshotPreview && !isProcessingUploads && (
               <p className="text-xs text-muted-foreground mt-2 text-center">Showing preview of the last uploaded image.</p>
             )}

             {/* Approval Checkbox */}
              <div className="flex items-center space-x-2 mt-4 self-start">
                <Checkbox
                    id="require-approval"
                    checked={requireApproval}
                    onCheckedChange={(checked) => setRequireApproval(Boolean(checked))}
                    disabled={isProcessingUploads}
                />
                <Label htmlFor="require-approval" className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Require approval before adding products
                </Label>
             </div>

          </CardContent>
        </Card>

        {/* Product Details Form Card (Manual Entry) */}
        <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 card"> {/* Added card class */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <ImageIcon className="h-5 w-5 text-primary"/>
              Manual Product Entry
            </CardTitle>
            <CardDescription>Enter product details manually if not using AI extraction.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
              <fieldset disabled={isProcessingUploads}> {/* Also disable manual form while processing uploads */}
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

                 {/* Hidden field for productImage (can be populated manually if needed later) */}
                 <FormField control={form.control} name="productImage" render={({field}) => ( <FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl></FormItem> )}/>

                  {/* Hidden field derived from quantity for consistency, value set in onSubmit */}
                 <FormField control={form.control} name="originalQuantityPurchased" render={({field}) => ( <FormItem className="hidden"><FormControl><Input type="hidden" value={form.getValues("quantity")} {...field} /></FormControl></FormItem> )}/>


                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button type="submit" className="flex-1 btn-primary btn" disabled={isProcessingUploads || isLoadingPrice}>
                    {isProcessingUploads ? 'Processing...' : 'Add Product Manually'}
                  </Button>
                  <Button type="button" variant="outline" className="flex-1 btn" onClick={calculateSuggestedPrice} disabled={isLoadingPrice || isProcessingUploads}>
                     {isLoadingPrice ? (
                         <> <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> Calculating... </>
                     ) : ( "Calculate Suggested Price" )}
                  </Button>
                </div>
              </form>
            </fieldset>
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

       {/* Pending Products Review Section */}
        {pendingProducts.length > 0 && (
            <Card className="w-full max-w-6xl shadow-lg card"> {/* Added card class */}
                <CardHeader>
                    <CardTitle>Review Pending Products ({pendingProducts.length})</CardTitle>
                    <CardDescription>Review, edit, and approve or discard products extracted from screenshots.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Hidden file input for pending product images */}
                    <Input
                        id="pending-product-image-upload"
                        type="file"
                        accept="image/png, image/jpeg, image/gif"
                        className="hidden"
                        onChange={handlePendingProductImageUpload}
                        ref={pendingProductImageInputRef} // Use the ref here
                    />
                    {pendingProducts.map((product, index) => (
                        <div key={`pending-${index}`} className="border rounded-lg p-4 space-y-4 relative group transition-all hover:shadow-md">
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700 btn" onClick={() => handleApprovePendingProduct(index)} aria-label="Approve Product">
                                     <CheckCircle className="h-5 w-5" />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700 btn" onClick={() => handleDiscardPendingProduct(index)} aria-label="Discard Product">
                                     <XCircle className="h-5 w-5" />
                                 </Button>
                            </div>
                            <div className="flex flex-col md:flex-row gap-6"> {/* Increased gap */}
                                {/* Product Image Upload/Preview */}
                                <div className="relative w-full md:w-32 h-32 flex-shrink-0 group/image">
                                    {product.productImage ? (
                                        <Image
                                            src={product.productImage} // Display current image (screenshot or uploaded)
                                            alt={product.productName || 'Pending Product Image'}
                                            layout="fill"
                                            objectFit="cover"
                                            className="rounded-md"
                                            data-ai-hint="pending product item"
                                        />
                                    ) : (
                                        <div className="w-full h-full rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                                            <ImageIcon className="h-10 w-10" />
                                        </div>
                                    )}
                                    {/* Edit Image Button */}
                                     <Button
                                        variant="secondary"
                                        size="icon"
                                        className="absolute bottom-1 right-1 h-7 w-7 opacity-0 group-hover/image:opacity-100 transition-opacity btn" // Added btn class
                                        onClick={() => handleEditPendingProductImage(index)}
                                        aria-label="Change product image"
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-grow">
                                    {/* Editable fields */}
                                    <div>
                                        <Label htmlFor={`pending-name-${index}`}>Product Name</Label>
                                        <Input
                                            id={`pending-name-${index}`}
                                            value={product.productName}
                                            onChange={(e) => handlePendingProductChange(index, 'productName', e.target.value)}
                                            className="input mt-1"
                                        />
                                    </div>
                                     <div>
                                        <Label htmlFor={`pending-quantity-${index}`}>Quantity</Label>
                                        <Input
                                            id={`pending-quantity-${index}`}
                                            type="number"
                                            value={product.quantity}
                                            onChange={(e) => handlePendingProductChange(index, 'quantity', e.target.value)}
                                            className="input mt-1" min="1"
                                        />
                                    </div>
                                     <div>
                                        <Label htmlFor={`pending-price-${index}`}>Total Price Paid</Label>
                                         <div className="relative mt-1">
                                             <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                             <Input
                                                id={`pending-price-${index}`}
                                                type="number"
                                                value={product.pricePaid}
                                                onChange={(e) => handlePendingProductChange(index, 'pricePaid', e.target.value)}
                                                className="input pl-8" step="0.01" min="0"
                                            />
                                         </div>
                                    </div>
                                    <div>
                                        <Label htmlFor={`pending-cost-${index}`}>Cost Price (Unit)</Label>
                                         <div className="relative mt-1">
                                             <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                             <Input
                                                id={`pending-cost-${index}`}
                                                type="number"
                                                value={product.costPrice || ''}
                                                onChange={(e) => handlePendingProductChange(index, 'costPrice', e.target.value)}
                                                placeholder="Optional"
                                                className="input pl-8" step="0.01" min="0"
                                            />
                                         </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )}

    </div>
  );
}
