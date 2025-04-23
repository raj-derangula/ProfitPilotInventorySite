"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardHeader, CardTitle, CardDescription} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {FormField, FormItem, FormLabel, FormControl, FormDescription, Form, useFormField} from "@/components/ui/form";
import {z} from "zod";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {useRouter} from "next/navigation";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";

interface ProductDetails {
  productName: string;
  pricePaid: string;
  quantityPurchased: string;
  costPrice?: string;
  productImage?: string;
}

const salesFormSchema = z.object({
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
  dateOfSale: z.date(),
});

type SalesFormValues = z.infer<typeof salesFormSchema>;

export default function SalesPage() {
  const [sales, setSales] = useState<SalesFormValues[]>([]);
  const {toast} = useToast();
  const router = useRouter();
  const [inventory, setInventory] = useState<ProductDetails[]>([]);
  const form = useForm<SalesFormValues>({
    resolver: zodResolver(salesFormSchema),
    defaultValues: {
      productName: "",
      salePrice: "",
      quantitySold: "",
      dateOfSale: new Date(),
    },
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
  }, []);

  useEffect(() => {
    // Save sales data to local storage whenever it changes
    localStorage.setItem("sales", JSON.stringify(sales));
  }, [sales]);

  const onSubmit = (values: SalesFormValues) => {
    // Add the new sale to the list of sales
    setSales([...sales, values]);
    toast({
      title: "Sale recorded!",
      description: `Sale of ${values.quantitySold} ${values.productName} recorded for $${values.salePrice} on ${values.dateOfSale.toLocaleDateString()}`,
    });
    form.reset();
  };

  const handleGoToInventory = () => {
    router.push("/inventory");
  };

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
              <FormField
                control={form.control}
                name="productName"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <Select onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a product..." />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((product, index) => (
                          <SelectItem key={index} value={product.productName}>
                            {`${product.productName} ($${product.pricePaid})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Select the name of the product sold.</FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salePrice"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Sale Price</FormLabel>
                    <FormControl>
                      <Input placeholder="Sale Price" {...field} />
                    </FormControl>
                    <FormDescription>Enter the price at which the product was sold.</FormDescription>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantitySold"
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
              <FormField
                control={form.control}
                name="dateOfSale"
                render={({field}) => (
                  <FormItem>
                    <FormLabel>Date of Sale</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>Enter the date of the sale.</FormDescription>
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
