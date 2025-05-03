// Using server directive tells nextjs that this is backend code.
"use client";

import {useState, useEffect, useRef} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Checkbox} from "@/components/ui/checkbox";
import {useToast} from "@/hooks/use-toast";
import {extractProductDetails} from "@/ai/flows/extract-product-details";
import {MarketTrendData, getMarketTrendData} from "@/services/market-trends";
import {Upload, X, Image as ImageIcon, DollarSign, Loader2, CheckCircle, XCircle, Edit, Crop} from "lucide-react"; // Added Crop icon
import {FormField, FormItem, FormLabel, FormControl, FormDescription, Form} from "@/components/ui/form";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useRouter} from "next/navigation";
import Image from 'next/image';
import { cn } from "@/lib/utils";
import ReactCrop, { type Crop as CropType, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog";


// Define the shape of the product data stored in localStorage
interface StoredProductDetails {
  productName: string;
  pricePaid: string; // Total price for original quantity
  quantity: string; // Current stock or final quantity in archive
  originalQuantityPurchased: string;
  costPrice?: string; // Unit cost
  productImage?: string; // Can be a data URI or placeholder URL
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
    // productImage field from ProductDetailsFormValues will hold the current image (cropped or original)
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
  const pendingProductImageInputRef = useRef<HTMLInputElement>(null); // Ref for pending product image input (for replacing screenshot)
  const [pendingProductImageIndex, setPendingProductImageIndex] = useState<number | null>(null); // Index of pending product to update image for

  // Cropping State
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [openCropDialog, setOpenCropDialog] = useState(false);
  const [cropDialogImageSrc, setCropDialogImageSrc] = useState<string | null>(null);
  const [cropDialogProductIndex, setCropDialogProductIndex] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);


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

        // Use the full screenshot data URI as the initial productImage and screenshotDataUri
        const productData: PendingProduct = {
            productName: productDetails.productName,
            pricePaid: productDetails.pricePaid.toString(),
            quantity: quantity.toString(),
            originalQuantityPurchased: quantity.toString(), // Set original quantity from AI
            costPrice: "", // Default cost price
            productImage: dataUri, // Use screenshot as final product image initially
            screenshotDataUri: dataUri, // Store the original screenshot separately
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

    // Trigger file input for a specific pending product to REPLACE the image
    const handleReplacePendingProductImage = (index: number) => {
        setPendingProductImageIndex(index);
        if (pendingProductImageInputRef.current) {
            pendingProductImageInputRef.current.click();
        }
    };

     // Handle the file selection for replacing pending product image
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

            // Update the specific pending product's productImage AND screenshotDataUri
            setPendingProducts(prev => {
                const updated = [...prev];
                if (updated[pendingProductImageIndex]) {
                    updated[pendingProductImageIndex].productImage = dataUri;
                    updated[pendingProductImageIndex].screenshotDataUri = dataUri; // Also update the source for cropping
                }
                return updated;
            });

            toast({
                title: "Image Replaced",
                description: `Image for ${pendingProducts[pendingProductImageIndex].productName} replaced. You can crop it or approve directly.`,
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

        // The productToApprove already holds the potentially edited values including the productImage (which could be cropped)
        const dataToInventory: ProductDetailsFormValues = {
            productName: productToApprove.productName,
            pricePaid: productToApprove.pricePaid,
            quantity: productToApprove.quantity,
            originalQuantityPurchased: productToApprove.originalQuantityPurchased, // Use the value from pending state
            costPrice: productToApprove.costPrice,
            productImage: productToApprove.productImage, // Pass the final image (original, replaced, or cropped)
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

    // --- Cropping Logic ---

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        // Suggest a centered 1:1 crop initially
        setCrop(centerCrop(
          makeAspectCrop(
            {
              unit: '%',
              width: 90, // Start with a large crop area
            },
            1 / 1, // Aspect ratio 1:1
            width,
            height
          ),
          width,
          height
        ));
    }

    function getCroppedImg(
        image: HTMLImageElement,
        crop: PixelCrop,
        fileName: string
    ): Promise<string> {
        const canvas = document.createElement("canvas");
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
        canvas.width = crop.width;
        canvas.height = crop.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            return Promise.reject(new Error("Canvas context not available"));
        }

        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = crop.width * pixelRatio;
        canvas.height = crop.height * pixelRatio;
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.imageSmoothingQuality = "high";

        ctx.drawImage(
            image,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            crop.width,
            crop.height
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("Canvas is empty"));
                    return;
                }
                // Convert blob to data URL
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            }, "image/png", 1); // Use PNG format for higher quality
        });
    }

    const handleOpenCropDialog = (index: number) => {
        const product = pendingProducts[index];
        if (product && product.screenshotDataUri) { // Use screenshotDataUri as source for cropping
            setCropDialogImageSrc(product.screenshotDataUri);
            setCropDialogProductIndex(index);
            setOpenCropDialog(true);
             // Reset crop state when opening dialog
             setCrop(undefined);
             setCompletedCrop(undefined);
        } else {
             toast({
                variant: "destructive",
                title: "Error",
                description: "Original screenshot image not found for cropping.",
             });
        }
    };

    const handleApplyCrop = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current && cropDialogProductIndex !== null) {
            try {
                const croppedImageDataUrl = await getCroppedImg(
                    imgRef.current,
                    completedCrop,
                    `cropped-${pendingProducts[cropDialogProductIndex].productName}.png`
                );
                // Update the productImage for the specific pending product
                setPendingProducts(prev => {
                    const updated = [...prev];
                    if (updated[cropDialogProductIndex]) {
                        updated[cropDialogProductIndex].productImage = croppedImageDataUrl;
                    }
                    return updated;
                });
                setOpenCropDialog(false);
                toast({
                    title: "Image Cropped",
                    description: `Image for ${pendingProducts[cropDialogProductIndex].productName} cropped successfully. Click Approve to save.`,
                });
            } catch (e) {
                console.error("Crop failed", e);
                 toast({
                    variant: "destructive",
                    title: "Cropping Failed",
                    description: "Could not crop the image. Please try again.",
                 });
            }
        } else {
             toast({
                variant: "destructive",
                title: "Crop Error",
                description: "Please select a crop area first.",
             });
        }
    };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10 px-4 space-y-10"> {/* Increased base spacing */}
      <h1 className="page-title">Add New Product</h1>

       {/* Upload and Manual Entry Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl"> {/* Change to lg for breakpoint */}
         {/* Screenshot Upload Card */}
        <Card className="card transition-all duration-300 hover:shadow-xl"> {/* Use card class, add transition */}
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <Upload className="h-5 w-5 text-primary" />
              Upload Order Screenshot(s)
            </CardTitle>
            <CardDescription>Let AI extract product details. You can upload multiple files.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 min-h-[300px] relative">
            {isProcessingUploads && (
              <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10 rounded-b-lg backdrop-blur-sm"> {/* Added backdrop blur */}
                <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
                <p className="text-muted-foreground">Processing uploads...</p>
              </div>
            )}
            {screenshotPreview ? (
              <div className="relative w-full aspect-video mb-4 group border rounded-md overflow-hidden shadow-inner"> {/* Added border and shadow */}
                <Image
                  src={screenshotPreview}
                  alt="Last Uploaded Screenshot Preview"
                  layout="fill"
                  objectFit="contain"
                  className="transition-transform duration-300 group-hover:scale-105"
                  data-ai-hint="order screenshot"
                />
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 btn backdrop-blur-sm bg-destructive/80 hover:bg-destructive" // Added btn, blur, alpha bg
                    onClick={() => handleRemoveScreenshotPreview()}
                    aria-label="Remove Screenshot Preview"
                    disabled={isProcessingUploads}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 btn backdrop-blur-sm bg-secondary/80 hover:bg-secondary" // Added btn, blur, alpha bg
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
                  "cursor-pointer border-2 border-dashed border-border hover:border-primary/80 transition-colors duration-200 rounded-lg p-8 flex flex-col items-center justify-center w-full text-center hover:bg-accent/50", // Added hover bg
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
              multiple // Allow multiple file selection
              ref={screenshotFileInputRef} // Use the ref here
            />
             {screenshotPreview && !isProcessingUploads && (
               <p className="text-xs text-muted-foreground mt-2 text-center">Showing preview of the last uploaded image.</p>
             )}

             {/* Approval Checkbox */}
              <div className="flex items-center space-x-2 mt-6 self-start w-full"> {/* Increased margin */}
                <Checkbox
                    id="require-approval"
                    checked={requireApproval}
                    onCheckedChange={(checked) => setRequireApproval(Boolean(checked))}
                    disabled={isProcessingUploads}
                />
                <Label htmlFor="require-approval" className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-0"> {/* Removed margin bottom */}
                    Require approval before adding products
                </Label>
             </div>

          </CardContent>
        </Card>

        {/* Product Details Form Card (Manual Entry) */}
        <Card className="card transition-all duration-300 hover:shadow-xl"> {/* Use card class */}
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


                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/50 mt-8"> {/* Added border-t and margin-top */}
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
                    {/* Hidden file input for replacing pending product images */}
                    <Input
                        id="pending-product-image-upload"
                        type="file"
                        accept="image/png, image/jpeg, image/gif"
                        className="hidden"
                        onChange={handlePendingProductImageUpload}
                        ref={pendingProductImageInputRef}
                    />
                    {pendingProducts.map((product, index) => (
                        <div key={`pending-${index}`} className="border rounded-lg p-4 space-y-4 relative group transition-shadow duration-200 hover:shadow-md bg-background"> {/* Added bg */}
                            <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"> {/* Adjusted positioning and gap */}
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700 btn rounded-full" onClick={() => handleApprovePendingProduct(index)} aria-label="Approve Product" title="Approve">
                                     <CheckCircle className="h-5 w-5" />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700 btn rounded-full" onClick={() => handleDiscardPendingProduct(index)} aria-label="Discard Product" title="Discard">
                                     <XCircle className="h-5 w-5" />
                                 </Button>
                            </div>
                            <div className="flex flex-col md:flex-row gap-6"> {/* Increased gap */}
                                {/* Product Image and Action Buttons */}
                                <div className="relative w-full md:w-36 h-36 flex-shrink-0 group/image border rounded-md overflow-hidden"> {/* Adjusted size, added border */}
                                    {product.productImage ? (
                                        <Image
                                            src={product.productImage} // Display current image (original, replaced, or cropped)
                                            alt={product.productName || 'Pending Product Image'}
                                            layout="fill"
                                            objectFit="cover" // Use cover to fill the square
                                            className="transition-transform duration-300 group-hover/image:scale-110" // Added zoom effect
                                            data-ai-hint="pending product item"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                                            <ImageIcon className="h-10 w-10" />
                                        </div>
                                    )}
                                    {/* Image Action Buttons */}
                                     <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200">
                                         <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-9 w-9 btn rounded-full bg-background/80 hover:bg-background" // Style adjustments
                                            onClick={() => handleOpenCropDialog(index)} // Open crop dialog
                                            aria-label="Crop product image"
                                            title="Crop Image"
                                            disabled={!product.screenshotDataUri} // Disable if no original screenshot
                                        >
                                            <Crop className="h-4 w-4" />
                                        </Button>
                                         <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-9 w-9 btn rounded-full bg-background/80 hover:bg-background" // Style adjustments
                                            onClick={() => handleReplacePendingProductImage(index)} // Replace image
                                            aria-label="Replace product image"
                                            title="Replace Image"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                     </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 flex-grow"> {/* Adjusted gap */}
                                    {/* Editable fields */}
                                    <div className="sm:col-span-2 lg:col-span-3"> {/* Name spans more cols */}
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

       {/* Crop Dialog */}
       <Dialog open={openCropDialog} onOpenChange={setOpenCropDialog}>
         <DialogContent className="sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]"> {/* Make dialog wider */}
           <DialogHeader>
             <DialogTitle>Crop Product Image</DialogTitle>
             <DialogDescription>
               Select the area for the product image. The original screenshot is used as the source.
             </DialogDescription>
           </DialogHeader>
           <div className="py-4 max-h-[70vh] overflow-auto flex justify-center items-center bg-muted/20 rounded-md border"> {/* Added bg, border */}
             {cropDialogImageSrc && (
               <ReactCrop
                 crop={crop}
                 onChange={c => setCrop(c)}
                 onComplete={c => setCompletedCrop(c)}
                 aspect={1} // Keep aspect ratio 1:1 for consistency
                 className="max-w-full max-h-full"
                 // style={{ background: 'rgba(0,0,0,0.1)' }} // Add subtle background to crop area itself if needed via style prop
               >
                 <img
                   ref={imgRef}
                   alt="Crop preview"
                   src={cropDialogImageSrc}
                   style={{ maxHeight: '65vh', display: 'block' }} // Limit image height and ensure block display
                   onLoad={onImageLoad}
                 />
               </ReactCrop>
             )}
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setOpenCropDialog(false)} className="btn">
               Cancel
             </Button>
             <Button onClick={handleApplyCrop} className="btn-primary btn">
               Apply Crop
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

    </div>
  );
}
