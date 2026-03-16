// using server directive tells nextjs that this is backend code.
'use server';

/**
 * @fileOverview Multi-signal product identification from images/video frames.
 *
 * Uses visual appearance, OCR text, and user history to identify items
 * with confidence scores for auto-approve routing.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ExtractProductDetailsInputSchema = z.object({
  mediaDataUris: z
    .array(z.string())
    .describe(
      "One or more images (or video frames) as data URIs. Each must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  itemHistorySummary: z
    .string()
    .optional()
    .describe('A text summary of the user\'s previously cataloged items for context matching.'),
  recentCorrections: z
    .string()
    .optional()
    .describe('Recent corrections the user made to AI suggestions, to improve accuracy.'),
});
export type ExtractProductDetailsInput = z.infer<typeof ExtractProductDetailsInputSchema>;

const ExtractedItemSchema = z.object({
  productName: z.string().describe('The name of the product. Be specific (include brand, model, size if visible).'),
  pricePaid: z.number().describe('The price paid for the product. 0 if not visible.'),
  quantityPurchased: z.number().describe('The quantity purchased. Default to 1 if not visible.'),
  category: z.string().describe('Product category, e.g. "Power Tools > Drills", "Electronics > Headphones", "Clothing > T-Shirts".'),
  sourcePlatform: z.string().describe('Where the item was purchased: "Temu", "Amazon", "eBay", "Walmart", "AliExpress", "Other", or "" if unknown.'),
  visualDescription: z.string().describe('Brief visual description of the item for future matching (color, shape, distinguishing features). Max 100 chars.'),
  confidence: z.number().describe('Confidence score 0.0-1.0 for this identification. 1.0 = absolutely certain, 0.5 = reasonable guess, <0.3 = very unsure.'),
  matchedHistoryItem: z.string().optional().describe('If this item matches something in the user\'s history, the exact product name from history. Otherwise omit.'),
});

const ExtractProductDetailsOutputSchema = z.object({
  items: z.array(ExtractedItemSchema).describe('Array of identified products. Usually 1 for single images, can be multiple for video frames or multi-item screenshots.'),
});
export type ExtractProductDetailsOutput = z.infer<typeof ExtractProductDetailsOutputSchema>;

// Legacy single-item output for backward compat with existing callers
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;

export async function extractProductDetails(input: ExtractProductDetailsInput): Promise<ExtractProductDetailsOutput> {
  return extractProductDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractProductDetailsPrompt',
  input: {
    schema: z.object({
      mediaDataUris: z.array(z.string()),
      itemHistorySummary: z.string().optional(),
      recentCorrections: z.string().optional(),
    }),
  },
  output: {
    schema: ExtractProductDetailsOutputSchema,
  },
  prompt: `You are an expert product identification AI for a reselling/inventory tracking app. Analyze the provided image(s) using ALL available signals:

## Analysis Signals (use all that apply):
1. **Visual appearance**: Shape, color, size, brand logos, packaging style, product type
2. **Text in image**: Any visible text, model numbers, brand names, barcodes, order confirmation text
3. **Price & quantity**: Look for prices, quantities, order totals, discounts
4. **Platform clues**: Recognize Temu, Amazon, eBay, AliExpress, Walmart order page layouts
5. **User history matching**: If the user's history is provided, check if this item matches or is similar to something they've bought before

## Rules:
- If multiple distinct products are visible across the images, return ALL of them as separate items
- If the same product appears across multiple frames (e.g., from a video), consolidate into ONE item
- Be specific with product names: include brand, model, size when visible
- Assign honest confidence scores:
  - 0.9-1.0: Clear text showing exact product name and price
  - 0.7-0.89: Can identify the product type and brand but some details are guessed
  - 0.5-0.69: Can see the product but details are unclear
  - Below 0.5: Very uncertain, mostly guessing
- If price includes shipping, try to extract just the item price
- Default quantity to 1 if not clearly shown
- For category, use a hierarchical format: "Main Category > Subcategory"
- For sourcePlatform, identify from page layout/branding if not explicitly stated

{{#if itemHistorySummary}}
## User's Item History (for matching):
{{itemHistorySummary}}

If the item looks like something in the user's history, set matchedHistoryItem to the exact name from history and boost confidence slightly.
{{/if}}

{{#if recentCorrections}}
## Previous AI Mistakes (avoid repeating):
{{recentCorrections}}
{{/if}}

## Image(s) to analyze:
{{#each mediaDataUris}}
{{media url=this}}
{{/each}}`,
});

const extractProductDetailsFlow = ai.defineFlow<
  typeof ExtractProductDetailsInputSchema,
  typeof ExtractProductDetailsOutputSchema
>({
  name: 'extractProductDetailsFlow',
  inputSchema: ExtractProductDetailsInputSchema,
  outputSchema: ExtractProductDetailsOutputSchema,
}, async input => {
  const {output} = await prompt(input);
  return output!;
});
