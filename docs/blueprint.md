# **App Name**: ProfitPilot

## Core Features:

- Product Input and Grouping: Allow users to upload screenshots of order confirmations, manually input product details, including name, price paid, quantity, and cost price. Products can be grouped together to allow for tracking of items purchased multiple times or in bundles.
- Profit Tracking and Price Adjustment: Suggest a selling price based on historical sales data. Calculate and track profit for each purchase, total profit, and daily profit. Log sales data, including sale price and date. Adjust suggested selling prices based on sales data. A running sales log is maintained for each item sold, showing the product name, sale price, and date.
- Screenshot OCR and Product Recognition: Use an AI tool for OCR (Optical Character Recognition) to extract product details from uploaded screenshots, including product name, price paid, and quantity purchased.

## Style Guidelines:

- Primary color: Soft green (#ECFDF5) to convey growth and profitability.
- Secondary color: Neutral grays (#F9FAFB, #E5E7EB) for backgrounds and text.
- Accent: Red (#880808) for interactive elements and highlights.
- Clean and modern typography for data clarity.
- Simple, intuitive icons for navigation and actions.
- Mobile-first responsive layout with clear sections and data tables.

## Original User Request:
Create a web app that I can use on my phone that allows me to:

Core Features:
Screenshot Upload and Product Recognition:

The app should allow me to upload screenshots of order confirmations from e-commerce websites (e.g., Temu, Amazon, etc.).

Use OCR (Optical Character Recognition) to extract product details from the screenshot, such as:

Product Name

Price Paid (including discounts or offers)

Quantity Purchased

Cost Price (if available, or leave blank if not)

Product Image (either extracted or entered manually)

Profit Tracking and Suggestions:

After extracting the product details, the app should:

Calculate Profit: Suggest a selling price based on historical sales data and market trends.

Track Profit for Each Purchase: For each item, the app should calculate the profit for that purchase by subtracting the Price Paid from the Suggested Selling Price.

Track Total Profit: Keep a total running profit for all purchases and sales.

Track Daily Profit: Keep track of profit for each day based on sales made on that day.

Sales Data Logging and Price Adjustment:

I should be able to enter the sale price and sale date for each item sold.

 The app should update a running sales log that includes:

Product Name

Sale Price

Sale Date

Based on this data, the app should adjust the suggested selling price for future purchases of similar products. If an item sells multiple times at a higher price, the suggested selling price should be increased.

Group Similar Products: If I purchase the same product multiple times or in bundles, group them together and track them as a single item in the inventory.

Running Record and Analytics:

Create a table or list view to display all of my purchases, including:

Product Name

Price Paid

Suggested Selling Price

Total Cost for Purchase (Price Paid * Quantity)

Profit for Each Purchase

Sale Price and Sale Date (once sold)

Profit Overview: A dashboard showing:

Total Profit

Profit by Day

Suggested Selling Price for future purchases

Include the ability to filter data by date, product, and other relevant parameters.

User Interface:

The app should have a simple, user-friendly interface suitable for mobile phones.

It should be easy to upload screenshots and enter sales data manually.

Include buttons or fields to enter the sale price and date of sale for items.

Responsive design so that it works seamlessly on both mobile and desktop screens.

Storage and Syncing:

Cloud-based storage to save data and sync across devices (so I can access it from both my phone and desktop).

The app should automatically save entries and allow for easy export to CSV or Excel for further analysis or reporting.

Technical Requirements:
Backend: The backend should use Python/Flask/Django (or equivalent) for handling data storage, processing, and business logic.

Frontend: The frontend should use React (or equivalent) for a responsive mobile-first design.

OCR API: Use a Google Vision API, Tesseract OCR, or other OCR tools to extract text from uploaded screenshots.

Database: Use a SQL or NoSQL database to store product data, sales, and profits.

Profit Calculation Logic: Implement algorithms to track profit and adjust the suggested selling price based on historical sales.

Optional Advanced Features (if possible):
Market Trend Integration: If feasible, integrate a market trend API to provide external data about product prices (e.g., scraping or pulling data from marketplaces like eBay or Amazon).

Dynamic Pricing Adjustments: Implement an AI model that adjusts suggested prices over time based on data trends (e.g., increasing price for fast-selling products, lowering it for slow-moving ones).

Goal: The goal of this app is to make it simple and automated for me to track my purchases, calculate profits, suggest future selling prices, and maintain a historical record of my reselling activity
  