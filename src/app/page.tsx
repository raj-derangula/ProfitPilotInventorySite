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
import {Upload, X, Image as ImageIcon, DollarSign, Loader2, CheckCircle, XCircle} from "lucide-react"; // Added CheckCircle, XCircle
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
    // Could add temporary ID if needed, but index is used for now
}

export default function Home() {
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [suggestedSellingPrice, setSuggestedSellingPrice] = useState<number | null>(null);
  const [isProcessingUploads, setIsProcessingUploads] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [requireApproval, setRequireApproval] = useState(false); // State for approval checkbox
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]); // State for pending products
  const {toast} = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

        const newProduct: StoredProductDetails = {
            ...productData,
            productImage: productData.productImage || `https://picsum.photos/seed/${encodeURIComponent(productData.productName)}/400/300`,
            originalQuantityPurchased: productData.quantity,
            quantity: String(productData.quantity),
            pricePaid: String(productData.pricePaid),
            costPrice: productData.costPrice ? String(productData.costPrice) : undefined,
        };

        const updatedProducts = [...existingProducts, newProduct];
        const updatedPurchasedProducts = [...existingPurchasedProducts, newProduct];

        const filteredProducts = updatedProducts.filter(product => parseInt(product.quantity, 10) > 0);

        localStorage.setItem("productDetails", JSON.stringify(filteredProducts));
        localStorage.setItem("purchasedProducts", JSON.stringify(updatedPurchasedProducts));

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

    setIsProcessingUploads(true);
    setScreenshotPreview(null);

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

        lastDataUri = dataUri;
        setScreenshotPreview(dataUri); // Preview current file

        const productDetails = await extractProductDetails({ screenshotDataUri: dataUri });
        const quantity = Math.max(1, productDetails.quantityPurchased);

        const productData: ProductDetailsFormValues = {
            productName: productDetails.productName,
            pricePaid: productDetails.pricePaid.toString(),
            quantity: quantity.toString(),
            originalQuantityPurchased: quantity.toString(),
            costPrice: "",
            productImage: dataUri,
        };

        // Check if approval is required
        if (requireApproval) {
            newlyPendingProducts.push(productData); // Add to temporary list for this batch
            pendingCount++;
        } else {
            addProductToInventory(productData);
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

     if (fileInputRef.current) {
        fileInputRef.current.value = '';
     }

    setIsProcessingUploads(false);

    // Add newly pending products to the main state
    if (newlyPendingProducts.length > 0) {
        setPendingProducts(prev => [...prev, ...newlyPendingProducts]);
    }

     // Updated summary toast
     let description = "";
     if (successCount > 0) description += `${successCount} product(s) added directly. `;
     if (pendingCount > 0) description += `${pendingCount} product(s) pending approval. `;
     if (errorCount > 0) description += `${errorCount} failed.`;

     toast({
        title: "Screenshot Processing Complete",
        description: description.trim(),
        variant: errorCount > 0 && successCount === 0 && pendingCount === 0 ? "destructive" : "default",
     });

     setSuggestedSellingPrice(null);

      // Redirect only if products were added directly AND no products are pending
      if (successCount > 0 && newlyPendingProducts.length === 0 && pendingProducts.length === 0) {
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
    const dataToAdd = { ...values, originalQuantityPurchased: values.quantity };
    addProductToInventory(dataToAdd);

    form.reset();
    setScreenshotPreview(null);
    setSuggestedSellingPrice(null);

    // Only redirect if no products are pending approval
    if (pendingProducts.length === 0) {
        router.push("/inventory");
    } else {
         toast({
            title: "Manual Product Added",
            description: "There are still products pending approval from screenshot uploads.",
         });
    }
};

    const handleRemoveScreenshotPreview = (showToast = true) => {
        setScreenshotPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (showToast) {
            toast({
                title: "Screenshot Preview Removed",
                description: "Ready for new upload or manual entry.",
            });
        }
    };

  const handleChangeScreenshot = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

   // --- Pending Product Handlers ---

    const handlePendingProductChange = (index: number, field: keyof PendingProduct, value: string) => {
        setPendingProducts(prev => {
            const updated = [...prev];
            if (updated[index]) {
                // @ts-ignore - Ignore type checking for dynamic field update
                updated[index][field] = value;
            }
            return updated;
        });
    };

    const handleApprovePendingProduct = (index: number) => {
        const productToApprove = pendingProducts[index];
        if (!productToApprove) return;

        // Basic validation before approving
        if (!productToApprove.productName.trim() || parseFloat(productToApprove.pricePaid) < 0 || parseInt(productToApprove.quantity, 10) <= 0) {
             toast({
                variant: "destructive",
                title: "Invalid Data",
                description: "Cannot approve product with invalid name, price, or quantity.",
             });
             return;
        }

        addProductToInventory(productToApprove); // Add the (potentially edited) product

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
            description: `${productToDiscard.productName} was removed from the pending list.`,
            variant: "destructive",
        });
    };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10 px-4 space-y-8"> {/* Added space-y */}
      <h1 className="page-title">Add New Product</h1>

       {/* Upload and Manual Entry Section */}
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
          <CardContent className="flex flex-col items-center justify-center p-6 min-h-[300px] relative"> {/* Increased min-height */}
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
              ref={fileInputRef}
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

                <FormField control={form.control} name="originalQuantityPurchased" render={({field}) => ( <FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl></FormItem> )}/>
                 <FormField control={form.control} name="productImage" render={({field}) => ( <FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl></FormItem> )}/>

                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button type="submit" className="flex-1 btn-primary" disabled={isProcessingUploads || isLoadingPrice}>
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
            <Card className="w-full max-w-6xl shadow-lg">
                <CardHeader>
                    <CardTitle>Review Pending Products ({pendingProducts.length})</CardTitle>
                    <CardDescription>Review and approve or discard products extracted from screenshots.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {pendingProducts.map((product, index) => (
                        <div key={`pending-${index}`} className="border rounded-lg p-4 space-y-4 relative group">
                            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700" onClick={() => handleApprovePendingProduct(index)} aria-label="Approve Product">
                                     <CheckCircle className="h-5 w-5" />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => handleDiscardPendingProduct(index)} aria-label="Discard Product">
                                     <XCircle className="h-5 w-5" />
                                 </Button>
                            </div>
                            <div className="flex flex-col md:flex-row gap-4">
                                {product.productImage && (
                                    <div className="relative w-full md:w-32 h-32 flex-shrink-0">
                                        <Image
                                            src={product.productImage}
                                            alt={product.productName || 'Pending Product Image'}
                                            layout="fill"
                                            objectFit="cover"
                                            className="rounded-md"
                                            data-ai-hint="pending product"
                                        />
                                    </div>
                                )}
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
