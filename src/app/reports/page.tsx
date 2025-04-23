"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";

interface ProductDetails {
  productName: string;
  pricePaid: string;
  quantityPurchased: string;
  costPrice?: string;
  productImage?: string;
}

interface SalesData {
  productName: string;
  salePrice: string;
  quantitySold: string;
  dateOfSale: Date;
}

export default function Reports() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [productDetails, setProductDetails] = useState<ProductDetails[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);

  useEffect(() => {
    // Load product details from local storage
    const storedProducts = localStorage.getItem("productDetails");
    if (storedProducts) {
      setProductDetails(JSON.parse(storedProducts));
    }

    // Load sales data from local storage
    const storedSales = localStorage.getItem("sales");
    if (storedSales) {
      setSalesData(JSON.parse(storedSales));
    }
  }, []);

  useEffect(() => {
    // Calculate totals for all time on component mount
    calculateTotals(null, null);
  }, [productDetails, salesData]);

  useEffect(() => {
    if (startDate && endDate) {
      calculateTotals(startDate, endDate);
    } else {
      // If either start or end date is cleared, recalculate totals for all time
      calculateTotals(null, null);
    }
  }, [startDate, endDate, productDetails, salesData]);

  const calculateTotals = (start: Date | null, end: Date | null) => {
    let spent = 0;
    let profit = 0;

    // Filter products within the date range (if applicable)
    const filteredProducts = productDetails.filter((product: ProductDetails) => {
      return true; // For now, consider all products (no date associated with product purchase)
    });

    // Calculate total spending
    spent = filteredProducts.reduce((acc: number, product: ProductDetails) => {
      const pricePaid = parseFloat(product.pricePaid || "0");
      const quantityPurchased = parseInt(product.quantityPurchased || "0", 10);
      return acc + pricePaid * quantityPurchased;
    }, 0);

    // Filter sales within the date range
    const filteredSales = salesData.filter((sale: SalesData) => {
      const saleDate = new Date(sale.dateOfSale);
      if (start && end) {
        return saleDate >= start && saleDate <= end;
      }
      return true; // Include all sales if no date range is selected
    });

    // Calculate total profit
    profit = filteredSales.reduce((acc: number, sale: SalesData) => {
      const salePrice = parseFloat(sale.salePrice || "0");
      const quantitySold = parseInt(sale.quantitySold || "0", 10);

      // Find the product details based on the product name in the sale
      const product = productDetails.find((p: ProductDetails) => p.productName === sale.productName);

      if (product) {
          const pricePaid = parseFloat(product.pricePaid || "0");
          const unitProfit = salePrice - pricePaid;
          return acc + unitProfit * quantitySold;
      } else {
          console.warn(`Product details not found for product: ${sale.productName}`);
          return acc; // Skip profit calculation if product details are not found
      }
    }, 0);

    setTotalSpent(spent);
    setTotalProfit(profit);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      setStartDate(null);
    } else {
      setStartDate(new Date(e.target.value));
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === "") {
      setEndDate(null);
    } else {
      setEndDate(new Date(e.target.value));
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10">
      <h1 className="text-3xl font-bold mb-4">Reports</h1>
      <div className="flex gap-4 mb-4">
        <div>
          <Label htmlFor="start-date">Start Date</Label>
          <Input
            type="date"
            id="start-date"
            onChange={handleStartDateChange}
          />
        </div>
        <div>
          <Label htmlFor="end-date">End Date</Label>
          <Input
            type="date"
            id="end-date"
            onChange={handleEndDateChange}
          />
        </div>
      </div>
      <div className="flex flex-col md:flex-row gap-4 w-full max-w-4xl p-4">
        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Spending Report</CardTitle>
            <CardDescription>Track your total spending.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totalSpent.toFixed(2)}</p>
            <p className="text-muted-foreground">Total amount spent on products.</p>
          </CardContent>
        </Card>

        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Profit Report</CardTitle>
            <CardDescription>See how much profit you've made.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totalProfit.toFixed(2)}</p>
            <p className="text-muted-foreground">Total profit from your products.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

