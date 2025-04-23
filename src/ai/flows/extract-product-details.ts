// using server directive tells nextjs that this is backend code.
'use server';

/**
 * @fileOverview Extracts product details from a screenshot using OCR and AI.
 *
 * - extractProductDetails - A function that handles the extraction of product details from a screenshot.
 * - ExtractProductDetailsInput - The input type for the extractProductDetails function.
 * - ExtractProductDetailsOutput - The return type for the extractProductDetails function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const ExtractProductDetailsInputSchema = z.object({
  screenshotDataUri: z
    .string()
    .describe(
      "A screenshot of an order confirmation, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractProductDetailsInput = z.infer<typeof ExtractProductDetailsInputSchema>;

const ExtractProductDetailsOutputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  pricePaid: z.number().describe('The price paid for the product.'),
  quantityPurchased: z.number().describe('The quantity of the product purchased.'),
});
export type ExtractProductDetailsOutput = z.infer<typeof ExtractProductDetailsOutputSchema>;

export async function extractProductDetails(input: ExtractProductDetailsInput): Promise<ExtractProductDetailsOutput> {
  return extractProductDetailsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractProductDetailsPrompt',
  input: {
    schema: z.object({
      screenshotDataUri: z
        .string()
        .describe(
          "A screenshot of an order confirmation, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
        ),
    }),
  },
  output: {
    schema: z.object({
      productName: z.string().describe('The name of the product.'),
      pricePaid: z.number().describe('The price paid for the product.'),
      quantityPurchased: z.number().describe('The quantity of the product purchased.'),
    }),
  },
  prompt: `You are an AI assistant specialized in extracting product details from order confirmation screenshots. Use OCR to read the text from the image and extract the product name, price paid, and quantity purchased. Return the values as structured JSON. If the image contains multiple products, focus on the first product found. If the price paid includes discounts or offers, include those in the extracted price.

Screenshot: {{media url=screenshotDataUri}}`,
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
