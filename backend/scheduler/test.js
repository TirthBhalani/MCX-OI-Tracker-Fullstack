const axios = require('axios');
const cron = require('node-cron'); // Correctly require the node-cron library
const OIData = require('../models/oidata.model.js');

// This variable will hold the dynamically fetched contracts.
// It will be an array of objects, e.g., [{ symbol: 'GOLD', expiryDate: '29AUG2025' }]
let activeContracts = [];

/**
 * Fetches and parses expiry dates from the MCX website.
 * This is based on the function you provided.
 */
const updateActiveContractsList = async () => {
    console.log("Attempting to fetch fresh expiry data from MCX...");
    try {
        const response = await axios.get("https://www.mcxindia.com/market-data/option-chain");
        const html = response.data;

        // Use regex to find the vTick variable in the script tag
        const match = html.match(/var\s+vTick\s*=\s*(\[.*?\]);/);
        if (match && match[1]) {
            const rawExpiryData = JSON.parse(match[1]);
            
            const newContracts = [];
            rawExpiryData.forEach(item => {
                // The Symbol and ExpiryDate properties come from the scraped data
                if (item.Symbol && item.ExpiryDate) {
                    newContracts.push({
                        symbol: item.Symbol,
                        expiryDate: item.ExpiryDate
                    });
                }
            });

            if (newContracts.length > 0) {
                activeContracts = newContracts;
                console.log(`Successfully updated active contracts. Found ${activeContracts.length} contracts.`);
            } else {
                console.warn("Could not parse any contracts from MCX data.");
            }
        } else {
            throw new Error("Could not find expiry data variable (vTick) in the MCX HTML response.");
        }
    } catch (error) {
        console.error("CRITICAL: Failed to fetch and update expiry data list.", error.message);
        // In a real-world scenario, you might want to add a notification alert here.
    }
};


/**
 * Fetches live option chain data from a third-party provider.
 * This function remains the same, but it's now called with dynamically fetched contracts.
 */
const fetchThirdPartyMCXData = async (symbol, expiryDate) => {
    // This function's logic is unchanged. It uses the provided symbol and expiry.
    const apiKey = process.env.MCX_API_KEY;
    const url = `https://api.yourdataprovider.com/v1/mcx/options/chain?symbol=${symbol}&expiry=${expiryDate}`;
    const headers = { 'Authorization': `Bearer ${apiKey}`, 'User-Agent': 'MCX-Tracker/1.0' };

    // MOCK RESPONSE FOR DEMONSTRATION (replace with real axios call)
    console.log(`[MOCK] Fetching MCX data for ${symbol} - ${expiryDate}`);
    return new Promise(resolve => setTimeout(() => resolve({
        records: { data: Array.from({ length: 20 }, () => ({
            CE: { openInterest: Math.floor(Math.random() * 2000) + 100 },
            PE: { openInterest: Math.floor(Math.random() * 2000) + 100 }
        }))}
    }), 500));
};

/**
 * Iterates through the dynamically fetched active contracts, gets their OI data, and stores it.
 */
const fetchDataAndStore = async () => {
    if (activeContracts.length === 0) {
        console.warn("Skipping data fetch cycle because the active contract list is empty.");
        return;
    }
    console.log(`Running scheduled job: Fetching OI data for ${activeContracts.length} contracts...`);
    
    for (const contract of activeContracts) {
        const { symbol, expiryDate } = contract;
        try {
            const apiResponse = await fetchThirdPartyMCXData(symbol, expiryDate);
            
            let callOI = 0;
            let putOI = 0;

            if (apiResponse?.records?.data) {
                apiResponse.records.data.forEach(item => {
                    callOI += item.CE?.openInterest || 0;
                    putOI += item.PE?.openInterest || 0;
                });
            } else {
                console.warn(`Warning: Received empty or invalid data for ${symbol} - ${expiryDate}`);
                continue;
            }
            
            const oiDifference = callOI - putOI;

            const newDataPoint = new OIData({ symbol, expiryDate, oiDifference });
            await newDataPoint.save();
            console.log(`Successfully stored data for ${symbol} - ${expiryDate}: OI Diff ${oiDifference}`);

        } catch (error) {
            console.error(`Skipping contract ${symbol} - ${expiryDate} due to fetch error.`);
        }
    }
};

/**
 * Initializes and starts all cron job schedulers.
 */
const startScheduler = async () => {
    // 1. Fetch the expiry list immediately when the server starts.
    await updateActiveContractsList();

    // 2. Schedule the expiry list to be updated once every day at 8:00 AM.
    cron.schedule('0 8 * * *', updateActiveContractsList, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
    console.log('Scheduled daily job: Expiry list will be updated every day at 8:00 AM.');

    // 3. Schedule the main data fetcher to run every minute.
    cron.schedule('* * * * *', fetchDataAndStore, {
        scheduled: true,
        timezone: "Asia/Kolkata"
    });
    console.log('Scheduled per-minute job: OI data will be fetched and stored every minute.');
};

module.exports = { startScheduler };
