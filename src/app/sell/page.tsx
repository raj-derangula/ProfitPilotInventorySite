"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {FormField, FormItem, FormLabel, FormControl, FormDescription, Form} from "@/components/ui/form";
import {z} from "zod";
import {useForm, useFieldArray} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useRouter} from "next/navigation";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Calendar} from "@/components/ui/calendar";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {cn} from "@/lib/utils";
import {format} from "date-fns";
import {CalendarIcon, DollarSign, ShoppingCart, PlusCircle, Trash2, Package, Info} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  type InventoryItem,
  type SaleRecord,
  generateId,
  getInventory,
  setInventory,
  getArchive,
  setArchive,
  getSales,
  putSale,
  initDB,
} from "@/lib/db";

const salesFormSchema = z.object({
  productsSold: z.array(
    z.object({
      productName: z.string().min(1, { message: "Product must be selected." }),
      salePrice: z.string().refine((value) => {
        try { const num = parseFloat(value); return !isNaN(num) && num >= 0; } catch (e) { return false; }
      }, { message: "Sale price must be a valid number." }),
      quantitySold: z.string().refine((value) => {
        try { const num = parseInt(value, 10); return !isNaN(num) && num > 0; } catch (e) { return false; }
      }, { message: "Quantity sold must be a positive integer." }),
    })
  ).min(1, {message: "At least one product must be added to the sale."}),
  dateOfSale: z.date({ required_error: "Date of sale is required." }),
});

type SalesFormValues = z.infer<typeof salesFormSchema>;

export default function SellPage() {
  const {toast} = useToast();
  const router = useRouter();
  const [inventory, setInventoryState] = useState<InventoryItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SalesFormValues>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      productsSold: [{ productName: "", salePrice: "", quantitySold: "" }],
      dateOfSale: new Date(),
    },
  });

  const {fields, append, remove} = useFieldArray({
    control: form.control,
    name: "productsSold",
  });

  useEffect(() => {
    (async () => {
      await initDB();
      const items = await getInventory();
      setInventoryState(items.filter(p => parseInt(p.quantity, 10) > 0));
    })();
  }, []);

  const calculateUnitPricePaid = (product: InventoryItem): string => {
    const price = parseFloat(product.pricePaid);
    const originalQty = parseInt(product.originalQuantityPurchased, 10);
    if (!isNaN(price) && !isNaN(originalQty) && originalQty > 0) {
      return (price / originalQty).toFixed(2);
    }
    return "N/A";
  };

  const onSubmit = async (values: SalesFormValues) => {
    setIsSubmitting(true);

    // Validation
    const inventoryMap = new Map(inventory.map(p => [p.productName, parseInt(p.quantity, 10)]));

    for (const productSold of values.productsSold) {
        const availableQuantity = inventoryMap.get(productSold.productName);
        if (availableQuantity === undefined) {
            toast({ title: "Validation Error", description: `Product "${productSold.productName}" not found in inventory.`, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        const quantityToSell = parseInt(productSold.quantitySold, 10);
        if (isNaN(quantityToSell) || quantityToSell <= 0) {
            toast({ title: "Validation Error", description: `Invalid quantity for "${productSold.productName}".`, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        if (quantityToSell > availableQuantity) {
            toast({ title: "Insufficient Stock", description: `Not enough "${productSold.productName}". Available: ${availableQuantity}, Trying to sell: ${quantityToSell}.`, variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
    }

    try {
        // Update inventory
        let updatedInventory = [...inventory];
        const archiveItems = await getArchive();
        let updatedArchive = [...archiveItems];

        for (const productSold of values.productsSold) {
            const quantitySoldNum = parseInt(productSold.quantitySold, 10);

            updatedInventory = updatedInventory.map(product => {
                if (product.productName === productSold.productName) {
                    return { ...product, quantity: (parseInt(product.quantity, 10) - quantitySoldNum).toString(), updatedAt: new Date().toISOString() };
                }
                return product;
            });

            updatedArchive = updatedArchive.map(product => {
                if (product.productName === productSold.productName) {
                    return { ...product, quantity: Math.max(0, parseInt(product.quantity, 10) - quantitySoldNum).toString(), updatedAt: new Date().toISOString() };
                }
                return product;
            });
        }

        updatedInventory = updatedInventory.filter(product => parseInt(product.quantity, 10) > 0);

        const saleRecord: SaleRecord = {
            id: `sale_${generateId()}`,
            productsSold: values.productsSold,
            dateOfSale: values.dateOfSale.toISOString(),
        };

        await setInventory(updatedInventory);
        await setArchive(updatedArchive);
        await putSale(saleRecord);

        setInventoryState(updatedInventory);

        toast({ title: "Sale Recorded!", description: `Sale of ${values.productsSold.length} product type(s) recorded.` });

        form.reset({
            productsSold: [{ productName: "", salePrice: "", quantitySold: "" }],
            dateOfSale: new Date(),
        });
    } catch (error) {
        console.error("Error saving sale data:", error);
        toast({ title: "Storage Error", description: "Failed to save sale data.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleGoToInventory = () => {
    router.push("/inventory");
  };

  const today = new Date();

  return (
    <TooltipProvider>
    <div className="flex flex-col items-center justify-start min-h-screen py-6 sm:py-10 px-3 sm:px-4">
      <h1 className="page-title mb-10">Record a New Sale</h1>
      <Card className="w-full max-w-4xl p-0 shadow-xl card">
        <CardHeader className="bg-muted/30 p-6 rounded-t-lg border-b">
          <CardTitle className="flex items-center gap-2 text-xl font-semibold">
            <ShoppingCart className="h-5 w-5 text-primary"/>
            Sale Details
          </CardTitle>
          <CardDescription>Record the products sold and the date of the transaction.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="space-y-6">
                 <Label className="text-base font-semibold block mb-2">Products Sold</Label>
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-col sm:flex-row items-start gap-4 border p-4 rounded-lg bg-background shadow-sm relative group">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 w-full">
                          <FormField
                            control={form.control}
                            name={`productsSold.${index}.productName`}
                            render={({field}) => (
                              <FormItem className="md:col-span-1">
                                <FormLabel>Product</FormLabel>
                                <FormControl>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger className="w-full input">
                                      <SelectValue placeholder="Select product..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {inventory.length === 0 && <SelectItem value="nodata" disabled>No products in inventory</SelectItem>}
                                      {inventory.map((product) => {
                                          const unitPaid = calculateUnitPricePaid(product);
                                          return (
                                            <SelectItem key={product.id} value={product.productName}>
                                                <div className="flex justify-between w-full">
                                                    <span className="truncate pr-2">{product.productName}</span>
                                                    <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                                                        (Stock: {product.quantity}, Paid: ${unitPaid})
                                                    </span>
                                                </div>
                                            </SelectItem>
                                          );
                                      })}
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                 <FormDescription className="text-xs flex items-center gap-1">
                                     <Info className="h-3 w-3" />
                                     Item sold (stock & unit cost shown).
                                 </FormDescription>
                                 {form.formState.errors.productsSold?.[index]?.productName && <p className="text-destructive text-xs mt-1">{form.formState.errors.productsSold[index]?.productName?.message}</p>}
                              </FormItem>
                            )}
                          />

                        <FormField
                            control={form.control}
                            name={`productsSold.${index}.quantitySold`}
                            render={({field}) => (
                            <FormItem className="md:col-span-1">
                                <FormLabel>Quantity Sold</FormLabel>
                                <FormControl>
                                <Input type="number" placeholder="e.g., 1" {...field} className="input" min="1"/>
                                </FormControl>
                                <FormDescription className="text-xs">Number of units.</FormDescription>
                                {form.formState.errors.productsSold?.[index]?.quantitySold && <p className="text-destructive text-xs mt-1">{form.formState.errors.productsSold[index]?.quantitySold?.message}</p>}
                            </FormItem>
                            )}
                        />

                        <FormField
                          control={form.control}
                          name={`productsSold.${index}.salePrice`}
                          render={({field}) => (
                            <FormItem className="md:col-span-1">
                              <FormLabel>Sale Price (Unit)</FormLabel>
                              <FormControl>
                                 <div className="relative">
                                     <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                                     <Input type="number" placeholder="e.g., 29.99" {...field} className="input pl-8" step="0.01" min="0"/>
                                 </div>
                              </FormControl>
                               <FormDescription className="text-xs">Price per single item.</FormDescription>
                               {form.formState.errors.productsSold?.[index]?.salePrice && <p className="text-destructive text-xs mt-1">{form.formState.errors.productsSold[index]?.salePrice?.message}</p>}
                            </FormItem>
                          )}
                        />
                      </div>
                       {fields.length > 1 && (
                         <Tooltip>
                             <TooltipTrigger asChild>
                                 <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => remove(index)}
                                    className="absolute top-2 right-2 sm:relative sm:top-auto sm:right-auto sm:self-center text-muted-foreground hover:text-destructive h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity"
                                    aria-label="Remove product from sale"
                                    >
                                    <Trash2 className="h-4 w-4" />
                                 </Button>
                             </TooltipTrigger>
                             <TooltipContent><p>Remove item</p></TooltipContent>
                         </Tooltip>
                       )}
                    </div>
                  ))}
                   <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({productName: "", salePrice: "", quantitySold: ""})}
                    className="btn mt-4 w-full sm:w-auto"
                   >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Another Product
                  </Button>
              </div>

              <FormField
                control={form.control}
                name="dateOfSale"
                render={({field}) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date of Sale</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full sm:w-[280px] justify-start text-left font-normal input",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => field.onChange(date)}
                          disabled={(date) => date > today || date < new Date("2000-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription className="text-xs">When the sale occurred.</FormDescription>
                    {form.formState.errors.dateOfSale && <p className="text-destructive text-xs mt-1">{form.formState.errors.dateOfSale.message}</p>}
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t mt-10">
                 <Button type="submit" className="flex-1 btn-primary btn w-full sm:w-auto" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                           <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                             <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                             <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                           Recording Sale...
                        </>
                    ) : ( "Record Sale" )}
                 </Button>
                 <Button type="button" variant="outline" className="flex-1 btn w-full sm:w-auto" onClick={handleGoToInventory}>
                    <Package className="mr-2 h-4 w-4"/> Go To Inventory
                 </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
