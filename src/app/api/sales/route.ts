import {NextResponse} from 'next/server';
// Example API route (api/sales)
export async function GET() {
  // Replace with your actual data fetching logic
  const data = { message: 'This is a Sell API route.' };
  return NextResponse.json(data);
}
