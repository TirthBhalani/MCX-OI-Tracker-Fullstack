// Application configuration

// Base URL for YOUR backend API to get historical data and expiries.
// FIX: The path now correctly includes '/data' to match the backend router.
export const API_BASE_URL = "http://localhost:3000/api/data"; 

// Direct URL to the MCX endpoint for fetching LIVE data.
export const MCX_LIVE_DATA_URL = "https://www.mcxindia.com/backpage.aspx/GetOptionChain";
