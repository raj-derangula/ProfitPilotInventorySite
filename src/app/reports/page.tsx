"use client";

import {useState} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";

export default function Reports() {
  // Mock data for demonstration
  const [totalSpent, setTotalSpent] = useState(1500);
  const [totalProfit, setTotalProfit] = useState(500);

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-10">
      <h1 className="text-3xl font-bold mb-4">Reports</h1>
      <div className="flex flex-col md:flex-row gap-4 w-full max-w-4xl p-4">
        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Spending Report</CardTitle>
            <CardDescription>Track your total spending.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totalSpent}</p>
            <p className="text-muted-foreground">Total amount spent on products.</p>
          </CardContent>
        </Card>

        <Card className="w-full md:w-1/2">
          <CardHeader>
            <CardTitle>Profit Report</CardTitle>
            <CardDescription>See how much profit you've made.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">${totalProfit}</p>
            <p className="text-muted-foreground">Total profit from your products.</p>
          </CardContent>
        </Card>
      </div>
      <Button>Generate Detailed Report</Button>
    </div>
  );
}
