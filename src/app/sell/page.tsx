"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {FormField, FormItem, FormLabel, FormControl, FormDescription, Form, useFormField} from "@/components/ui/form";
import {z} from "zod";
import {useForm, useFieldArray} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useRouter} from "next/navigation";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Calendar} from "@/components/ui/calendar";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {cn} from "@/lib/utils";
import {format} from "date-fns";
import {CalendarIcon} from "lucide-react";

interface ProductDetails {
  productName: string;
  pricePaid: string;
  quantityPurchased: string;
  costPrice?: string;
  productImage?: string;
}

const salesFormSchema = z.object({
  productsSold: z.array(
    z.object({
      productName: z.string().min(2, {
        message: "Product name must be at least 2 characters.",
      }),
      salePrice: z.string().refine((value) => {
        try {
          const num = parseFloat(value);
          return !isNaN(num) && num > 0;
        } catch (e) {
          return false;
        }
      }, {
        message: "Sale price must be a valid number greater than zero.",
      }),
      quantitySold: z.string().refine((value) => {
        try {
          const num = parseInt(value, 10);
          return !isNaN(num) && num > 0;
        } catch (e) {
          return false;
        }
      }, {
        message: "Quantity sold must be a valid integer greater than zero.",
      }),
    })
  ).min(1, {message: "At least one product must be selected"}),
  dateOfSale: z.date(),
});

type SalesFormValues = z.infer<typeof salesFormSchema>;

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const {toast} = useToast();
  const router = useRouter();
  const [inventory, setInventory] = useState<ProductDetails[]>([]);
  const [purchasedProducts, setPurchasedProducts] = useState<ProductDetails[]>([]);

  const form = useForm<SalesFormValues>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      productsSold: [],
      dateOfSale: new Date(),
    },
  });

  const {fields, append, remove} = useFieldArray({
    control: form.control,
    name: "productsSold",
  });

  useEffect(() => {
    // Load sales data from local storage on component mount
    const storedSales = localStorage.getItem("sales");
    if (storedSales) {
      setSales(JSON.parse(storedSales));
    }

    // Load inventory data from local storage
    const storedInventory = localStorage.getItem("productDetails");
    if (storedInventory) {
      setInventory(JSON.parse(storedInventory));
    }

    // Load purchased products from local storage
    const storedPurchasedProducts = localStorage.getItem("purchasedProducts");
    if (storedPurchasedProducts) {
      setPurchasedProducts(JSON.parse(storedPurchasedProducts));
    }
  }, []);

  useEffect(() => {
    // Save sales data to local storage whenever it changes
    localStorage.setItem("sales", JSON.stringify(sales));
  }, [sales]);

  const onSubmit = (values: SalesFormValues) => {
    // First, validate that all quantities are valid based on inventory
    for (const productSold of values.productsSold) {
      const inventoryProduct = inventory.find(p => p.productName === productSold.productName);
      if (!inventoryProduct) {
        toast({
          title: "Error recording sale!",
          description: `Product ${productSold.productName} not found in inventory.`,
          variant: "destructive",
        });
        return;
      }

      const purchased = parseInt(inventoryProduct.quantityPurchased, 10);
      const quantitySold = parseInt(productSold.quantitySold, 10);

      if (quantitySold > purchased) {
        toast({
          title: "Error recording sale!",
          description: `Not enough ${productSold.productName} in inventory.`,
          variant: "destructive",
        });
        return;
      }
    }

    // If all quantities are valid, proceed to update inventory and record sale
    let updatedInventory = [...inventory];
    let updatedPurchasedProducts = [...purchasedProducts];

    for (const productSold of values.productsSold) {
      updatedInventory = updatedInventory.map((product) => {
        if (product.productName === productSold.productName) {
          const purchased = parseInt(product.quantityPurchased, 10);
          const quantitySold = parseInt(productSold.quantitySold, 10);
          const remaining = purchased - quantitySold;
          return {
            ...product,
            quantityPurchased: remaining.toString(),
          };
        }
        return product;
      });
    }

    // Filter out products with quantityPurchased equal to 0
    updatedInventory = updatedInventory.filter(product => parseInt(product.quantityPurchased, 10) > 0);

    // Save updated inventory to local storage
    localStorage.setItem("productDetails", JSON.stringify(updatedInventory));
    setInventory(updatedInventory);

        // Add the sold products to the purchasedProducts list, or update the quantity if it already exists
        values.productsSold.forEach(soldProduct => {
          const existingProductIndex = updatedPurchasedProducts.findIndex(p => p.productName === soldProduct.productName);
          if (existingProductIndex !== -1) {
              // Update quantityPurchased if the product already exists
              updatedPurchasedProducts[existingProductIndex] = {
                  ...updatedPurchasedProducts[existingProductIndex],
                  quantityPurchased: (parseInt(updatedPurchasedProducts[existingProductIndex].quantityPurchased, 10) - parseInt(soldProduct.quantitySold, 10)).toString()
              };
          }
      });

    // Save updated inventory to local storage
    localStorage.setItem("productDetails", JSON.stringify(updatedInventory));
    setInventory(updatedInventory);

        localStorage.setItem("purchasedProducts", JSON.stringify(updatedPurchasedProducts));
        setPurchasedProducts(updatedPurchasedProducts);

    // Add the new sale to the list of sales
    setSales([...sales, values]);
    toast({
      title: "Sale recorded!",
      description: `Sale of ${values.productsSold.length} products recorded on ${values.dateOfSale.toLocaleDateString()}`,
    });
    form.reset();
  };

  const handleGoToInventory = () => {
    router.push("/inventory");
  };

  const today = new Date();

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10">
      <h1 className="text-3xl font-bold mb-4">Record a Sale</h1>
      <Card className="w-full max-w-4xl p-4">
        <CardHeader>
          <CardTitle>Sale Details</CardTitle>
          <CardDescription>Record the details of your sale.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {fields.map((product, index) => (
                <div key={product.id} className="space-y-2 border p-4 rounded">
                  <div className="flex justify-between">
                    <h3 className="text-lg font-semibold">Product {index + 1}</h3>
                    <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>
                      Remove
                    </Button>
                  </div>
                  <FormField
                    control={form.control}
                    name={`productsSold.${index}.productName`}
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Product Name</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a product..." />
                            </SelectTrigger>
                            <SelectContent>
                              {inventory.map((product, inventoryIndex) => {
                                return parseInt(product.quantityPurchased, 10) > 0 ? (
                                  <SelectItem key={inventoryIndex} value={product.productName}>
                                    {`${product.productName} ($${product.pricePaid}) - Quantity: ${product.quantityPurchased}`}
                                  </SelectItem>
                                ) : null;
                              })}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription>Select the product sold.</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`productsSold.${index}.salePrice`}
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Sale Price</FormLabel>
                        <FormControl>
                          <Input placeholder="Sale Price" {...field} />
                        </FormControl>
                        <FormDescription>Enter the price you sold the product for.</FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`productsSold.${index}.quantitySold`}
                    render={({field}) => (
                      <FormItem>
                        <FormLabel>Quantity Sold</FormLabel>
                        <FormControl>
                          <Input placeholder="Quantity Sold" {...field} />
                        </FormControl>
                        <FormDescription>Enter the quantity of the product sold.</FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              ))}
              <Button type="button" onClick={() => append({productName: "", salePrice: "", quantitySold: ""})}>Add Product</Button>
              <FormField
                control={form.control}
                name="dateOfSale"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Date of Sale</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-[240px] pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                          }}
                          disabled={(date) =>
                            date > today || date < new Date("2020-01-01")
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>Enter the date the product was sold.</FormDescription>
                  </FormItem>
                )}
              />
              <Button type="submit">Record Sale</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Button className="mt-4" onClick={handleGoToInventory}>
        Go To Inventory
      </Button>
    </div>
  );
}

