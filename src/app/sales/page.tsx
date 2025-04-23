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
    const quantitySold = parseInt(values.quantitySold, 10);

    // Update inventory
    const updatedInventory = inventory.map((product) => {
      if (product.productName === values.productName) {
        const purchased = parseInt(product.quantityPurchased, 10);
        const remaining = purchased - quantitySold;
        return {
          ...product,
          quantityPurchased: remaining.toString(),
        };
      }
      return product;
    });

    // Save updated inventory to local storage
    localStorage.setItem("productDetails", JSON.stringify(updatedInventory));
    setInventory(updatedInventory);

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
    
      
        
          Record a Sale
        
        
          
            Sale Details
            Record the details of your sale.
          
          
            
              
                Product Name
              
              <Select onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {inventory.map((product, index) => (
                    // Only show product if there is quantity left
                    parseInt(product.quantityPurchased, 10) > 0 ? (
                      <SelectItem key={index} value={product.productName}>
                        {`${product.productName} ($${product.pricePaid}) - Quantity: ${product.quantityPurchased}`}
                      </SelectItem>
                    ) : null
                  ))}
                </SelectContent>
              </Select>
              
            
              
                Sale Price
              
              
                <Input placeholder="Sale Price" {...field} />
              
              
            
              
                Quantity Sold
              
              
                <Input placeholder="Quantity Sold" {...field} />
              
              
            
              
                Date of Sale
              
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
                      date > new Date() || date < new Date("2020-01-01")
                    }
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
            
            <Button type="submit">Record Sale</Button>
          
        
      
      <Button className="mt-4" onClick={handleGoToInventory}>
        Go To Inventory
      </Button>
    
  );
}
