"use client";

import {useState, useRef, useEffect} from "react";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {useToast} from "@/hooks/use-toast";
import {Download, Upload, FileSpreadsheet, AlertTriangle, CheckCircle} from "lucide-react";
import {
  getInventory,
  getArchive,
  getSales,
  setInventory,
  setArchive,
  setSales,
  initDB,
  type InventoryItem,
  type SaleRecord,
} from "@/lib/db";
import {
  inventoryToCsv,
  salesToCsv,
  csvToInventoryItems,
  csvToSaleRecords,
  downloadCsv,
} from "@/lib/csv";

export default function DataPage() {
  const {toast} = useToast();
  const [inventoryCount, setInventoryCount] = useState(0);
  const [archiveCount, setArchiveCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const inventoryFileRef = useRef<HTMLInputElement>(null);
  const archiveFileRef = useRef<HTMLInputElement>(null);
  const salesFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      await initDB();
      const [inv, arch, sales] = await Promise.all([getInventory(), getArchive(), getSales()]);
      setInventoryCount(inv.length);
      setArchiveCount(arch.length);
      setSalesCount(sales.length);
    })();
  }, []);

  // --- Export ---

  const handleExportInventory = async () => {
    const items = await getInventory();
    if (items.length === 0) {
      toast({ title: "No Data", description: "No inventory items to export.", variant: "destructive" });
      return;
    }
    downloadCsv(inventoryToCsv(items), `profitpilot-inventory-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: "Inventory Exported", description: `${items.length} items exported to CSV.` });
  };

  const handleExportArchive = async () => {
    const items = await getArchive();
    if (items.length === 0) {
      toast({ title: "No Data", description: "No archived items to export.", variant: "destructive" });
      return;
    }
    downloadCsv(inventoryToCsv(items), `profitpilot-archive-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: "Archive Exported", description: `${items.length} items exported to CSV.` });
  };

  const handleExportSales = async () => {
    const sales = await getSales();
    if (sales.length === 0) {
      toast({ title: "No Data", description: "No sales records to export.", variant: "destructive" });
      return;
    }
    downloadCsv(salesToCsv(sales), `profitpilot-sales-${new Date().toISOString().slice(0, 10)}.csv`);
    toast({ title: "Sales Exported", description: `${sales.length} sale records exported to CSV.` });
  };

  const handleExportAll = async () => {
    await handleExportInventory();
    await handleExportArchive();
    await handleExportSales();
  };

  // --- Import ---

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleImportInventory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await readFileAsText(file);
      const items = csvToInventoryItems(text);
      if (items.length === 0) {
        toast({ title: "No Data", description: "No valid items found in CSV.", variant: "destructive" });
        return;
      }
      await setInventory(items);
      setInventoryCount(items.length);
      toast({ title: "Inventory Imported", description: `${items.length} items imported successfully.` });
    } catch (error: any) {
      console.error("Import error:", error);
      toast({ title: "Import Error", description: error.message || "Failed to import CSV.", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (inventoryFileRef.current) inventoryFileRef.current.value = '';
    }
  };

  const handleImportArchive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await readFileAsText(file);
      const items = csvToInventoryItems(text);
      if (items.length === 0) {
        toast({ title: "No Data", description: "No valid items found in CSV.", variant: "destructive" });
        return;
      }
      await setArchive(items);
      setArchiveCount(items.length);
      toast({ title: "Archive Imported", description: `${items.length} items imported successfully.` });
    } catch (error: any) {
      console.error("Import error:", error);
      toast({ title: "Import Error", description: error.message || "Failed to import CSV.", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (archiveFileRef.current) archiveFileRef.current.value = '';
    }
  };

  const handleImportSales = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await readFileAsText(file);
      const sales = csvToSaleRecords(text);
      if (sales.length === 0) {
        toast({ title: "No Data", description: "No valid sales found in CSV.", variant: "destructive" });
        return;
      }
      await setSales(sales);
      setSalesCount(sales.length);
      toast({ title: "Sales Imported", description: `${sales.length} sale records imported successfully.` });
    } catch (error: any) {
      console.error("Import error:", error);
      toast({ title: "Import Error", description: error.message || "Failed to import CSV.", variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (salesFileRef.current) salesFileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-screen py-6 sm:py-10 px-3 sm:px-4">
      <h1 className="page-title mb-10 flex items-center gap-3">
        <FileSpreadsheet className="h-8 w-8 text-primary" />
        Import & Export Data
      </h1>

      <div className="w-full max-w-4xl space-y-8">
        {/* Warning */}
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Important:</strong> Importing data will <strong>replace</strong> existing data in that category. Export your current data first as a backup before importing.
            Product images are not included in CSV exports.
          </div>
        </div>

        {/* Export Section */}
        <Card className="card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Export Data
            </CardTitle>
            <CardDescription>Download your data as CSV files for backup or analysis.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Button onClick={handleExportInventory} variant="outline" className="btn w-full">
                <Download className="mr-2 h-4 w-4" />
                Inventory ({inventoryCount})
              </Button>
              <Button onClick={handleExportArchive} variant="outline" className="btn w-full">
                <Download className="mr-2 h-4 w-4" />
                Archive ({archiveCount})
              </Button>
              <Button onClick={handleExportSales} variant="outline" className="btn w-full">
                <Download className="mr-2 h-4 w-4" />
                Sales ({salesCount})
              </Button>
            </div>
            <Button onClick={handleExportAll} className="btn-primary btn w-full">
              <Download className="mr-2 h-4 w-4" />
              Export All Data
            </Button>
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card className="card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Import Data
            </CardTitle>
            <CardDescription>Upload CSV files to import data. Files must match the export format.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Import Inventory */}
            <div className="space-y-2">
              <Label className="font-medium">Import Inventory</Label>
              <p className="text-xs text-muted-foreground">
                Expected columns: id, productName, category, sourcePlatform, pricePaid, costPrice, quantity, originalQuantityPurchased, visualDescription, aiConfidence, createdAt, updatedAt
              </p>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleImportInventory}
                  disabled={isImporting}
                  ref={inventoryFileRef}
                  className="input"
                />
              </div>
            </div>

            {/* Import Archive */}
            <div className="space-y-2">
              <Label className="font-medium">Import Archive</Label>
              <p className="text-xs text-muted-foreground">Same format as inventory CSV.</p>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleImportArchive}
                  disabled={isImporting}
                  ref={archiveFileRef}
                  className="input"
                />
              </div>
            </div>

            {/* Import Sales */}
            <div className="space-y-2">
              <Label className="font-medium">Import Sales</Label>
              <p className="text-xs text-muted-foreground">
                Expected columns: saleId, dateOfSale, productName, salePrice, quantitySold
              </p>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleImportSales}
                  disabled={isImporting}
                  ref={salesFileRef}
                  className="input"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
