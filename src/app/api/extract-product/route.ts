import { NextRequest, NextResponse } from 'next/server';
import { extractProductDetailsFlow } from '@/ai/flows/extract-product-details';

export async function POST(req: NextRequest) {
  try {
    const { data: input } = await req.json();

    if (!input?.mediaDataUris?.length) {
      return NextResponse.json(
        { error: { message: 'No images or videos provided.' } },
        { status: 400 }
      );
    }

    if (!process.env.REACT_APP_GEMINI_API_KEY) {
      return NextResponse.json(
        { error: { message: 'Gemini API key is not configured. Add REACT_APP_GEMINI_API_KEY to your .env file. Get a free key at https://aistudio.google.com/apikey' } },
        { status: 500 }
      );
    }

    const resp = await extractProductDetailsFlow.run(input);
    return NextResponse.json({ result: resp.result });
  } catch (e: any) {
    console.error('Error in extract-product API:', e);
    const message = e.message || 'An unexpected error occurred while processing your image.';
    return NextResponse.json(
      { error: { message } },
      { status: 500 }
    );
  }
}
