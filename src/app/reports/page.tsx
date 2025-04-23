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
  productsSold: {
    productName: string;
    salePrice: string;
    quantitySold: string;
  }[];
  dateOfSale: Date;
}

export default function Reports() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
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
    let revenue = 0;

    // Calculate total spending
    spent = productDetails.reduce((acc: number, product: ProductDetails) => {
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

    // Calculate total profit and revenue
    filteredSales.forEach((sale: SalesData) => {
      sale.productsSold.forEach((soldProduct) => {
        const product = productDetails.find((p: ProductDetails) => p.productName === soldProduct.productName);
        if (product) {
          const pricePaid = parseFloat(product.pricePaid || "0");
          const salePrice = parseFloat(soldProduct.salePrice || "0");
          const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);
          const unitProfit = salePrice - pricePaid;
          revenue += salePrice * quantitySold; // Accumulate total revenue
          profit += unitProfit * quantitySold;
        } else {
          console.warn(`Product details not found for product: ${soldProduct.productName}`);
        }
      });
    });

    setTotalSpent(spent);
    setTotalProfit(profit);
    setTotalRevenue(revenue);
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
        <Card className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle>Spending Report</CardTitle>
            <CardDescription>Track your total spending.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totalSpent.toFixed(2)}</p>
            <p className="text-muted-foreground">Total amount spent on products.</p>
          </CardContent>
        </Card>

        <Card className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle>Profit Report</CardTitle>
            <CardDescription>See how much profit you've made.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totalProfit.toFixed(2)}</p>
            <p className="text-muted-foreground">Total profit from your products.</p>
          </CardContent>
        </Card>

        <Card className="w-full md:w-1/3">
          <CardHeader>
            <CardTitle>Revenue Report</CardTitle>
            <CardDescription>See how much revenue you've made.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totalRevenue.toFixed(2)}</p>
            <p className="text-muted-foreground">Total revenue from your products.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
