"use client";

import {useState, useEffect} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {ScrollArea} from "@/components/ui/scroll-area";

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

interface PurchasedProduct {
  productName: string;
  pricePaid: string;
  quantityPurchased: string;
  costPrice?: string;
  productImage?: string;
}

export default function Reports() {
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [productDetails, setProductDetails] = useState<ProductDetails[]>([]);
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [filteredSalesData, setFilteredSalesData] = useState<SalesData[]>([]);
  const [allPurchasedProducts, setAllPurchasedProducts] = useState<PurchasedProduct[]>([]);

  useEffect(() => {
    // Load product details from local storage
    const storedProducts = localStorage.getItem("productDetails");
    if (storedProducts) {
      setProductDetails(JSON.parse(storedProducts));
    }

    // Load sales data from local storage
    const storedSales = localStorage.getItem("sales");
    if (storedSales) {
      const parsedSales = JSON.parse(storedSales);
      // Sort sales data by date in descending order (most recent first)
      parsedSales.sort((a: SalesData, b: SalesData) => new Date(b.dateOfSale).getTime() - new Date(a.dateOfSale).getTime());
      setSalesData(parsedSales);
    }

    // Load purchased products from local storage
    const storedPurchasedProducts = localStorage.getItem("purchasedProducts");
    if (storedPurchasedProducts) {
      setAllPurchasedProducts(JSON.parse(storedPurchasedProducts));
    }
  }, []);

  useEffect(() => {
    // Calculate totals for all time on component mount
    calculateTotals(null, null);
  }, [productDetails, salesData, allPurchasedProducts]);

  useEffect(() => {
    if (startDate && endDate) {
      calculateTotals(startDate, endDate);
    } else {
      // If either start or end date is cleared, recalculate totals for all time
      calculateTotals(null, null);
    }
  }, [startDate, endDate, productDetails, salesData, allPurchasedProducts]);

  const calculateTotals = (start: Date | null, end: Date | null) => {
    let spent = 0;
    let profit = 0;
    let revenue = 0;
    let filteredSales: SalesData[] = salesData;

    // Calculate total spending
    spent = allPurchasedProducts.reduce((acc: number, product: any) => {
      const pricePaid = parseFloat(product.pricePaid || "0");
      const quantityPurchased = parseInt(product.quantityPurchased || "0", 10);
      return acc + pricePaid * quantityPurchased;
    }, 0);


    // Filter sales within the date range
    if (start && end) {
      const endOfDay = new Date(end);
      endOfDay.setHours(23, 59, 59, 999);

      filteredSales = salesData.filter((sale: SalesData) => {
        const saleDate = new Date(sale.dateOfSale);
        return saleDate >= start && saleDate <= endOfDay;
      });
    }

    // Calculate total profit and revenue
    filteredSales.forEach((sale: SalesData) => {
      sale.productsSold.forEach((soldProduct) => {
        // Try to find the product in purchasedProducts first
        const product = allPurchasedProducts.find((p: PurchasedProduct) => p.productName === soldProduct.productName);

        if (product) {
          const pricePaid = parseFloat(product.pricePaid || "0");
          const costPrice = parseFloat(product.costPrice || "0") || pricePaid;
          const salePrice = parseFloat(soldProduct.salePrice || "0");
          const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);
          const unitProfit = salePrice - costPrice;

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
    setFilteredSalesData(filteredSales);
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

      <div className="w-full max-w-4xl p-4">
        <Card>
          <CardHeader>
            <CardTitle>Sales Orders</CardTitle>
            <CardDescription>List of sales orders within the selected time period.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] w-full">
              {filteredSalesData.length > 0 ? (
                <ul>
                  {filteredSalesData.map((sale: SalesData, index: number) => {
                    let saleProfit = 0;
                    let saleRevenue = 0;
                    let saleSpending = 0;

                    sale.productsSold.forEach((soldProduct) => {
                      const product = allPurchasedProducts.find((p: PurchasedProduct) => p.productName === soldProduct.productName);

                      if (product) {
                        const pricePaid = parseFloat(product.pricePaid || "0");
                        const costPrice = parseFloat(product.costPrice || "0") || pricePaid;
                        const salePrice = parseFloat(soldProduct.salePrice || "0");
                        const quantitySold = parseInt(soldProduct.quantitySold || "0", 10);
                        const unitProfit = salePrice - costPrice;

                        saleRevenue += salePrice * quantitySold; // Accumulate total revenue
                        saleProfit += unitProfit * quantitySold;
                        saleSpending += pricePaid * quantitySold;
                      } else {
                        console.warn(`Product details not found for product: ${soldProduct.productName}`);
                      }
                    });

                    return (
                      <li key={index} className="mb-2 border-b pb-2">
                        <p className="font-semibold">
                          Sale Date: {new Date(sale.dateOfSale).toLocaleDateString()}
                        </p>
                        <p>
                          Products Sold:
                          {sale.productsSold.map((soldProduct, i) => (
                            <span key={i}>
                              {soldProduct.productName} ({soldProduct.quantitySold} x ${soldProduct.salePrice})
                              {i < sale.productsSold.length - 1 ? ", " : ""}
                            </span>
                          ))}
                        </p>
                        <p>Sale Profit: ${saleProfit.toFixed(2)}</p>
                        <p>Sale Revenue: ${saleRevenue.toFixed(2)}</p>
                        <p>Sale Spending: ${saleSpending.toFixed(2)}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>No sales orders found for the selected time period.</p>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
