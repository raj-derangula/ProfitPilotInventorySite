"use client";

import {useState, useEffect, useRef} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Checkbox} from "@/components/ui/checkbox";
import {useToast} from "@/hooks/use-toast";
import {extractProductDetails, type ExtractedItem} from "@/ai/flows/extract-product-details";
import {MarketTrendData, getMarketTrendData} from "@/services/market-trends";
import {Upload, X, Image as ImageIcon, DollarSign, Loader2, CheckCircle, XCircle, Edit, Crop, Video, AlertTriangle} from "lucide-react";
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
import {
  type InventoryItem,
  generateId,
  normalizeItem,
  getInventory,
  putInventoryItem,
  getArchive,
  putArchiveItem,
  getItemHistorySummary,
  getRecentCorrections,
  addCorrection,
  initDB,
} from "@/lib/db";
import { validateVideoFile, extractFrames } from "@/lib/video-frames";

// Auto-approve threshold
const HIGH_CONFIDENCE = 0.85;
const LOW_CONFIDENCE = 0.5;

// Schema for the main form and pending products
const productDetailsSchema = z.object({
  productName: z.string().min(2, {
    message: "Product name must be at least 2 characters.",
  }),
  pricePaid: z.string().refine((value) => {
    try {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
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
     if (value === undefined || value === "") return true;
    try {
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    } catch (e) {
      return false;
    }
  }, {
      message: "Cost price must be a valid number if provided.",
  }),
  productImage: z.string().optional(),
});

interface ProductDetailsFormValues extends z.infer<typeof productDetailsSchema> {}

// Pending product includes AI metadata
interface PendingProduct extends ProductDetailsFormValues {
    screenshotDataUri?: string;
    category: string;
    sourcePlatform: string;
    visualDescription: string;
    aiConfidence: number;
    matchedHistoryItem?: string;
    // Track original AI suggestions for correction feedback
    originalAiName?: string;
    originalAiPrice?: string;
    originalAiCategory?: string;
}

export default function Home() {
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [suggestedSellingPrice, setSuggestedSellingPrice] = useState<number | null>(null);
  const [isProcessingUploads, setIsProcessingUploads] = useState(false);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);
  const [pendingProducts, setPendingProducts] = useState<PendingProduct[]>([]);
  const {toast} = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingProductImageInputRef = useRef<HTMLInputElement>(null);
  const [pendingProductImageIndex, setPendingProductImageIndex] = useState<number | null>(null);

  // Cropping State
  const [crop, setCrop] = useState<CropType>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [openCropDialog, setOpenCropDialog] = useState(false);
  const [cropDialogImageSrc, setCropDialogImageSrc] = useState<string | null>(null);
  const [cropDialogProductIndex, setCropDialogProductIndex] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // DB init
  useEffect(() => { initDB(); }, []);

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

    // Helper function to add a single product to inventory and archive (now uses IndexedDB)
    const addProductToInventory = async (productData: ProductDetailsFormValues & {
      category?: string;
      sourcePlatform?: string;
      visualDescription?: string;
      aiConfidence?: number;
    }) => {
        const existingProducts = await getInventory();
        const existingArchive = await getArchive();

        const imageToUse = productData.productImage || `https://picsum.photos/seed/${encodeURIComponent(productData.productName)}/400/300`;

        const now = new Date().toISOString();

        // Check archive for existing item
        const existingArchiveItem = existingArchive.find(p => p.productName === productData.productName);

        if (existingArchiveItem) {
            const oldTotalPaid = parseFloat(existingArchiveItem.pricePaid) || 0;
            const oldOriginalQty = parseInt(existingArchiveItem.originalQuantityPurchased, 10) || 0;
            const oldCurrentQty = parseInt(existingArchiveItem.quantity, 10) || 0;
            const newTotalPaid = parseFloat(productData.pricePaid) || 0;
            const newOriginalQty = parseInt(productData.originalQuantityPurchased, 10) || 0;

            existingArchiveItem.pricePaid = (oldTotalPaid + newTotalPaid).toFixed(2);
            existingArchiveItem.originalQuantityPurchased = (oldOriginalQty + newOriginalQty).toString();
            existingArchiveItem.quantity = (oldCurrentQty + newOriginalQty).toString();
            existingArchiveItem.productImage = imageToUse;
            existingArchiveItem.updatedAt = now;
            if (productData.category) existingArchiveItem.category = productData.category;
            if (productData.sourcePlatform) existingArchiveItem.sourcePlatform = productData.sourcePlatform;
            if (productData.visualDescription) existingArchiveItem.visualDescription = productData.visualDescription;
            await putArchiveItem(existingArchiveItem);
        } else {
            await putArchiveItem(normalizeItem({
                ...productData,
                productImage: imageToUse,
                createdAt: now,
                updatedAt: now,
            }));
        }

        // Check inventory for existing item
        const existingInvItem = existingProducts.find(p => p.productName === productData.productName);

        if (existingInvItem) {
            const oldInvQty = parseInt(existingInvItem.quantity, 10) || 0;
            const newInvQty = parseInt(productData.quantity, 10) || 0;
            const oldInvOriginalQty = parseInt(existingInvItem.originalQuantityPurchased, 10) || 0;
            const newInvOriginalQty = parseInt(productData.originalQuantityPurchased, 10) || 0;
            const oldInvTotalPaid = parseFloat(existingInvItem.pricePaid) || 0;
            const newInvTotalPaid = parseFloat(productData.pricePaid) || 0;

            existingInvItem.quantity = (oldInvQty + newInvQty).toString();
            existingInvItem.originalQuantityPurchased = (oldInvOriginalQty + newInvOriginalQty).toString();
            existingInvItem.pricePaid = (oldInvTotalPaid + newInvTotalPaid).toFixed(2);
            existingInvItem.productImage = imageToUse;
            existingInvItem.updatedAt = now;
            if (productData.category) existingInvItem.category = productData.category;
            if (productData.sourcePlatform) existingInvItem.sourcePlatform = productData.sourcePlatform;
            if (productData.visualDescription) existingInvItem.visualDescription = productData.visualDescription;
            await putInventoryItem(existingInvItem);
        } else {
            const newQty = parseInt(productData.quantity, 10);
            if (newQty > 0) {
                await putInventoryItem(normalizeItem({
                    ...productData,
                    productImage: imageToUse,
                    createdAt: now,
                    updatedAt: now,
                }));
            }
        }

        toast({
            title: "Product Added/Updated!",
            description: `${productData.productName} (${productData.quantity}) added/updated in inventory.`,
        });
    };

  // Process uploaded files (images + videos)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingUploads(true);
    setScreenshotPreview(null);

    let successCount = 0;
    let errorCount = 0;
    let pendingCount = 0;
    let autoAddedCount = 0;
    const newlyPendingProducts: PendingProduct[] = [];

    // Gather context for Gemini
    let historySummary: string | undefined;
    let corrections: string | undefined;
    try {
      [historySummary, corrections] = await Promise.all([
        getItemHistorySummary(),
        getRecentCorrections(),
      ]);
    } catch (e) {
      console.warn('Failed to load context for AI:', e);
    }

    for (const file of Array.from(files)) {
      try {
        let mediaDataUris: string[];

        if (file.type.startsWith('video/')) {
          // Video: validate and extract frames
          const validationError = validateVideoFile(file);
          if (validationError) {
            toast({ variant: "destructive", title: `Video Error (${file.name})`, description: validationError.error });
            errorCount++;
            continue;
          }

          toast({ title: `Processing video: ${file.name}`, description: "Extracting frames..." });
          const result = await extractFrames(file);
          mediaDataUris = result.frames;
          if (result.frames.length > 0) {
            setScreenshotPreview(result.frames[0]);
          }
        } else {
          // Image: convert to base64
          const dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          mediaDataUris = [dataUri];
          setScreenshotPreview(dataUri);
        }

        // Call enhanced Gemini
        const result = await extractProductDetails({
          mediaDataUris,
          itemHistorySummary: historySummary || undefined,
          recentCorrections: corrections || undefined,
        });

        // Process each identified item
        for (const item of result.items) {
          const quantity = Math.max(1, item.quantityPurchased);
          const imageUri = file.type.startsWith('video/') ? mediaDataUris[0] : mediaDataUris[0];

          const productData: PendingProduct = {
            productName: item.productName,
            pricePaid: item.pricePaid.toString(),
            quantity: quantity.toString(),
            originalQuantityPurchased: quantity.toString(),
            costPrice: "",
            productImage: imageUri,
            screenshotDataUri: imageUri,
            category: item.category,
            sourcePlatform: item.sourcePlatform,
            visualDescription: item.visualDescription,
            aiConfidence: item.confidence,
            matchedHistoryItem: item.matchedHistoryItem,
            originalAiName: item.productName,
            originalAiPrice: item.pricePaid.toString(),
            originalAiCategory: item.category,
          };

          // Confidence-based routing
          if (item.confidence >= HIGH_CONFIDENCE) {
            // Auto-add high-confidence items
            await addProductToInventory({
              productName: productData.productName,
              pricePaid: productData.pricePaid,
              quantity: productData.quantity,
              originalQuantityPurchased: productData.originalQuantityPurchased,
              costPrice: productData.costPrice,
              productImage: productData.productImage,
              category: productData.category,
              sourcePlatform: productData.sourcePlatform,
              visualDescription: productData.visualDescription,
              aiConfidence: productData.aiConfidence,
            });
            autoAddedCount++;
          } else {
            // Send to review
            newlyPendingProducts.push(productData);
            pendingCount++;
          }
        }

        successCount++;
      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        toast({
          variant: "destructive",
          title: `AI Error (${file.name})`,
          description: error.message || "Failed to extract details.",
        });
        errorCount++;
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsProcessingUploads(false);

    if (newlyPendingProducts.length > 0) {
      setPendingProducts(prev => [...prev, ...newlyPendingProducts]);
    }

    // Summary toast
    const parts: string[] = [];
    if (autoAddedCount > 0) parts.push(`${autoAddedCount} auto-added (high confidence)`);
    if (pendingCount > 0) parts.push(`${pendingCount} pending review`);
    if (errorCount > 0) parts.push(`${errorCount} failed`);

    toast({
      title: "Processing Complete",
      description: parts.join('. ') || `${successCount} file(s) processed.`,
      variant: errorCount > 0 && autoAddedCount === 0 && pendingCount === 0 ? "destructive" : "default",
    });

    setSuggestedSellingPrice(null);

    if (autoAddedCount > 0 && pendingProducts.length === 0 && newlyPendingProducts.length === 0) {
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
        title: "Suggested Selling Price",
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

 const onSubmit = async (values: ProductDetailsFormValues) => {
    const dataToAdd = {
        ...values,
        originalQuantityPurchased: values.quantity,
        productImage: values.productImage || "",
    };
    await addProductToInventory(dataToAdd);

    form.reset();
    setScreenshotPreview(null);
    setSuggestedSellingPrice(null);

    if (pendingProducts.length === 0) {
        router.push("/inventory");
    } else {
         toast({
            title: "Manual Product Added/Updated",
            description: "There are still products pending approval.",
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
                title: "Preview Removed",
                description: "Ready for new upload.",
            });
        }
    };

  const handleChangeFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

   // --- Pending Product Handlers ---

    const handlePendingProductChange = (index: number, field: keyof PendingProduct, value: string) => {
        setPendingProducts(prev => {
            const updated = [...prev];
            if (updated[index]) {
                (updated[index] as any)[field] = value;
                 if (field === 'quantity') {
                    updated[index].originalQuantityPurchased = value;
                 }
            }
            return updated;
        });
    };

    const handleReplacePendingProductImage = (index: number) => {
        setPendingProductImageIndex(index);
        if (pendingProductImageInputRef.current) {
            pendingProductImageInputRef.current.click();
        }
    };

    const handlePendingProductImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || pendingProductImageIndex === null) return;

        const reader = new FileReader();
        try {
            const dataUri = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setPendingProducts(prev => {
                const updated = [...prev];
                if (updated[pendingProductImageIndex]) {
                    updated[pendingProductImageIndex].productImage = dataUri;
                    updated[pendingProductImageIndex].screenshotDataUri = dataUri;
                }
                return updated;
            });

            toast({
                title: "Image Replaced",
                description: `Image for ${pendingProducts[pendingProductImageIndex].productName} replaced.`,
            });
        } catch (error) {
            console.error("Error reading product image file:", error);
            toast({ variant: "destructive", title: "Image Upload Error", description: "Failed to read the selected image." });
        } finally {
            if (pendingProductImageInputRef.current) {
                pendingProductImageInputRef.current.value = '';
            }
            setPendingProductImageIndex(null);
        }
    };


    const handleApprovePendingProduct = async (index: number) => {
        const productToApprove = pendingProducts[index];
        if (!productToApprove) return;

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

        // Record corrections if user edited AI suggestions
        if (productToApprove.originalAiName && productToApprove.productName !== productToApprove.originalAiName) {
            await addCorrection({
                id: generateId(),
                originalSuggestion: productToApprove.originalAiName,
                correctedValue: productToApprove.productName,
                field: 'productName',
                timestamp: new Date().toISOString(),
            });
        }
        if (productToApprove.originalAiPrice && productToApprove.pricePaid !== productToApprove.originalAiPrice) {
            await addCorrection({
                id: generateId(),
                originalSuggestion: productToApprove.originalAiPrice,
                correctedValue: productToApprove.pricePaid,
                field: 'pricePaid',
                timestamp: new Date().toISOString(),
            });
        }
        if (productToApprove.originalAiCategory && productToApprove.category !== productToApprove.originalAiCategory) {
            await addCorrection({
                id: generateId(),
                originalSuggestion: productToApprove.originalAiCategory,
                correctedValue: productToApprove.category,
                field: 'category',
                timestamp: new Date().toISOString(),
            });
        }

        await addProductToInventory({
            productName: productToApprove.productName,
            pricePaid: productToApprove.pricePaid,
            quantity: productToApprove.quantity,
            originalQuantityPurchased: productToApprove.originalQuantityPurchased,
            costPrice: productToApprove.costPrice,
            productImage: productToApprove.productImage,
            category: productToApprove.category,
            sourcePlatform: productToApprove.sourcePlatform,
            visualDescription: productToApprove.visualDescription,
            aiConfidence: productToApprove.aiConfidence,
        });

        setPendingProducts(prev => prev.filter((_, i) => i !== index));

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
            description: `${productToDiscard.productName || 'Pending product'} was removed.`,
            variant: "destructive",
        });
    };

    // --- Cropping Logic ---

    function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
        const { width, height } = e.currentTarget;
        setCrop(centerCrop(
          makeAspectCrop(
            { unit: '%', width: 90 },
            1 / 1,
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
    ): Promise<string> {
        const canvas = document.createElement("canvas");
        const scaleX = image.naturalWidth / image.width;
        const scaleY = image.naturalHeight / image.height;
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
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            }, "image/png", 1);
        });
    }

    const handleOpenCropDialog = (index: number) => {
        const product = pendingProducts[index];
        if (product && product.screenshotDataUri) {
            setCropDialogImageSrc(product.screenshotDataUri);
            setCropDialogProductIndex(index);
            setOpenCropDialog(true);
             setCrop(undefined);
             setCompletedCrop(undefined);
        } else {
             toast({
                variant: "destructive",
                title: "Error",
                description: "Original image not found for cropping.",
             });
        }
    };

    const handleApplyCrop = async () => {
        if (completedCrop?.width && completedCrop?.height && imgRef.current && cropDialogProductIndex !== null) {
            try {
                const croppedImageDataUrl = await getCroppedImg(
                    imgRef.current,
                    completedCrop,
                );
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
                    description: `Image cropped successfully. Click Approve to save.`,
                });
            } catch (e) {
                console.error("Crop failed", e);
                 toast({
                    variant: "destructive",
                    title: "Cropping Failed",
                    description: "Could not crop the image.",
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

  // Confidence badge color
  const confidenceBadge = (confidence: number) => {
    if (confidence >= HIGH_CONFIDENCE) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (confidence >= LOW_CONFIDENCE) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  };


  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-6 sm:py-10 px-3 sm:px-4 space-y-6 sm:space-y-10">
      <h1 className="page-title">Add New Product</h1>

       {/* Upload and Manual Entry Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
         {/* Upload Card (Images + Videos) */}
        <Card className="card transition-all duration-300 hover:shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <Upload className="h-5 w-5 text-primary" />
              Upload Screenshots or Videos
            </CardTitle>
            <CardDescription>
              Upload order screenshots or screen recordings. AI will identify items using visual analysis, text, and your purchase history.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 min-h-[300px] relative">
            {isProcessingUploads && (
              <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center z-10 rounded-b-lg backdrop-blur-sm">
                <Loader2 className="animate-spin h-8 w-8 text-primary mb-2" />
                <p className="text-muted-foreground">Processing uploads...</p>
              </div>
            )}
            {screenshotPreview ? (
              <div className="relative w-full aspect-video mb-4 group border rounded-md overflow-hidden shadow-inner">
                <Image
                  src={screenshotPreview}
                  alt="Upload Preview"
                  layout="fill"
                  objectFit="contain"
                  className="transition-transform duration-300 group-hover:scale-105"
                  data-ai-hint="order screenshot"
                />
                <div className="absolute top-2 right-2 flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 btn backdrop-blur-sm bg-destructive/80 hover:bg-destructive"
                    onClick={() => handleRemoveScreenshotPreview()}
                    aria-label="Remove Preview"
                    disabled={isProcessingUploads}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 btn backdrop-blur-sm bg-secondary/80 hover:bg-secondary"
                    onClick={handleChangeFile}
                    aria-label="Upload New File"
                     disabled={isProcessingUploads}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Label
                htmlFor="file-upload"
                className={cn(
                  "cursor-pointer border-2 border-dashed border-border hover:border-primary/80 transition-colors duration-200 rounded-lg p-8 flex flex-col items-center justify-center w-full text-center hover:bg-accent/50",
                   isProcessingUploads && "cursor-not-allowed opacity-50"
                )}
              >
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <span className="text-sm font-medium text-foreground">Click or Drag to Upload</span>
                <span className="text-xs text-muted-foreground mt-1">Images: PNG, JPG, GIF | Videos: MP4, WebM, MOV</span>
                <span className="text-xs text-muted-foreground mt-0.5">Videos: max 30s, 50MB | Multiple files allowed</span>
              </Label>
            )}
            <Input
              id="file-upload"
              type="file"
              accept="image/png, image/jpeg, image/gif, video/mp4, video/webm, video/quicktime"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isProcessingUploads}
              multiple
              ref={fileInputRef}
            />
             {screenshotPreview && !isProcessingUploads && (
               <p className="text-xs text-muted-foreground mt-2 text-center">Showing preview of the last uploaded file.</p>
             )}

             {/* Info about confidence routing */}
              <div className="flex items-start space-x-2 mt-6 self-start w-full p-3 rounded-md bg-muted/50 border">
                <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <strong>Smart routing:</strong> High-confidence items are auto-added. Lower confidence items appear below for review. Corrections you make improve future accuracy.
                </div>
             </div>

          </CardContent>
        </Card>

        {/* Product Details Form Card (Manual Entry) */}
        <Card className="card transition-all duration-300 hover:shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <ImageIcon className="h-5 w-5 text-primary"/>
              Manual Product Entry
            </CardTitle>
            <CardDescription>Enter product details manually if not using AI extraction.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <Form {...form}>
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

                 <FormField control={form.control} name="productImage" render={({field}) => ( <FormItem className="hidden"><FormControl><Input type="hidden" {...field} /></FormControl></FormItem> )}/>
                 <FormField control={form.control} name="originalQuantityPurchased" render={({field}) => ( <FormItem className="hidden"><FormControl><Input type="hidden" {...field} value={form.getValues("quantity")} /></FormControl></FormItem> )}/>


                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/50 mt-8">
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
            <Card className="w-full max-w-6xl shadow-lg card">
                <CardHeader>
                    <CardTitle>Review Pending Products ({pendingProducts.length})</CardTitle>
                    <CardDescription>These items need your review. Edit details and approve or discard. Your corrections improve future AI accuracy.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <Input
                        id="pending-product-image-upload"
                        type="file"
                        accept="image/png, image/jpeg, image/gif"
                        className="hidden"
                        onChange={handlePendingProductImageUpload}
                        ref={pendingProductImageInputRef}
                    />
                    {pendingProducts.map((product, index) => (
                        <div key={`pending-${index}`} className="border rounded-lg p-4 space-y-4 relative group transition-shadow duration-200 hover:shadow-md bg-background">
                            <div className="absolute top-3 right-3 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 z-10">
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:bg-green-100 hover:text-green-700 btn rounded-full" onClick={() => handleApprovePendingProduct(index)} aria-label="Approve Product" title="Approve">
                                     <CheckCircle className="h-5 w-5" />
                                 </Button>
                                 <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-100 hover:text-red-700 btn rounded-full" onClick={() => handleDiscardPendingProduct(index)} aria-label="Discard Product" title="Discard">
                                     <XCircle className="h-5 w-5" />
                                 </Button>
                            </div>
                            <div className="flex flex-col md:flex-row gap-6">
                                {/* Product Image */}
                                <div className="relative w-full md:w-36 h-36 flex-shrink-0 group/image border rounded-md overflow-hidden">
                                    {product.productImage ? (
                                        <Image
                                            src={product.productImage}
                                            alt={product.productName || 'Pending Product Image'}
                                            layout="fill"
                                            objectFit="cover"
                                            className="transition-transform duration-300 group-hover/image:scale-110"
                                            data-ai-hint="pending product item"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground">
                                            <ImageIcon className="h-10 w-10" />
                                        </div>
                                    )}
                                     <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 group-hover/image:opacity-100 transition-opacity duration-200">
                                         <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-9 w-9 btn rounded-full bg-background/80 hover:bg-background"
                                            onClick={() => handleOpenCropDialog(index)}
                                            aria-label="Crop product image"
                                            title="Crop Image"
                                            disabled={!product.screenshotDataUri}
                                        >
                                            <Crop className="h-4 w-4" />
                                        </Button>
                                         <Button
                                            variant="secondary"
                                            size="icon"
                                            className="h-9 w-9 btn rounded-full bg-background/80 hover:bg-background"
                                            onClick={() => handleReplacePendingProductImage(index)}
                                            aria-label="Replace product image"
                                            title="Replace Image"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                     </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 flex-grow">
                                    {/* Confidence badge */}
                                    <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-2">
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", confidenceBadge(product.aiConfidence))}>
                                            Confidence: {Math.round(product.aiConfidence * 100)}%
                                        </span>
                                        {product.category && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                                {product.category}
                                            </span>
                                        )}
                                        {product.sourcePlatform && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                                {product.sourcePlatform}
                                            </span>
                                        )}
                                        {product.matchedHistoryItem && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                                Matches: {product.matchedHistoryItem}
                                            </span>
                                        )}
                                    </div>

                                    {/* Editable fields */}
                                    <div className="sm:col-span-2 lg:col-span-3">
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
                                    {/* Category (editable) */}
                                    <div>
                                        <Label htmlFor={`pending-category-${index}`}>Category</Label>
                                        <Input
                                            id={`pending-category-${index}`}
                                            value={product.category || ''}
                                            onChange={(e) => handlePendingProductChange(index, 'category', e.target.value)}
                                            placeholder="e.g., Power Tools > Drills"
                                            className="input mt-1"
                                        />
                                    </div>
                                    {/* Source Platform (editable) */}
                                    <div>
                                        <Label htmlFor={`pending-source-${index}`}>Source Platform</Label>
                                        <Input
                                            id={`pending-source-${index}`}
                                            value={product.sourcePlatform || ''}
                                            onChange={(e) => handlePendingProductChange(index, 'sourcePlatform', e.target.value)}
                                            placeholder="e.g., Temu, Amazon"
                                            className="input mt-1"
                                        />
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
         <DialogContent className="sm:max-w-[600px] md:max-w-[800px] lg:max-w-[1000px]">
           <DialogHeader>
             <DialogTitle>Crop Product Image</DialogTitle>
             <DialogDescription>
               Select the area for the product image.
             </DialogDescription>
           </DialogHeader>
           <div className="py-4 max-h-[70vh] overflow-auto flex justify-center items-center bg-muted/20 rounded-md border">
             {cropDialogImageSrc && (
               <ReactCrop
                 crop={crop}
                 onChange={c => setCrop(c)}
                 onComplete={c => setCompletedCrop(c)}
                 aspect={1}
                 className="max-w-full max-h-full"
               >
                 <img
                   ref={imgRef}
                   alt="Crop preview"
                   src={cropDialogImageSrc}
                   style={{ maxHeight: '65vh', display: 'block' }}
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
