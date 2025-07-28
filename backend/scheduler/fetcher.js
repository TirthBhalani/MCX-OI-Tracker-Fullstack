const axios = require('axios');
const cron = require('node-cron');
const getOIDataModel = require('../models/oidata.model.js');
const Expiry = require('../models/expiry.model.js');

// This will hold only the nearest 2 contracts for each symbol for the per-minute job.
let activeContracts = [];

/**
 * Fetches expiry dates, stores them in the DB, and populates the activeContracts array
 * with only the two nearest expiries for each symbol.
 */
const updateActiveContractsList = async () => {
    console.log("Attempting to fetch and store fresh expiry data...");
    try {
        const url = "https://www.mcxindia.com/market-data/option-chain";
        // Correct headers to fetch the HTML page
        const headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/json",
            "Origin": "https://www.mcxindia.com",
            "Referer": "https://www.mcxindia.com/market-data/option-chain",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest"
        };
        
        const response = await axios.get(url, { headers });
        const html = response.data;

        const match = html.match(/var\s+vTick\s*=\s*(\[.*?\]);/);
        if (match && match[1]) {
            const rawExpiryData = JSON.parse(match[1]);
            const expiryDataBySymbol = rawExpiryData.reduce((acc, item) => {
                if (!acc[item.Symbol]) acc[item.Symbol] = [];
                acc[item.Symbol].push(item.ExpiryDate);
                return acc;
            }, {});

            const newContracts = [];
            for (const symbol in expiryDataBySymbol) {
                // Sort dates to find the nearest ones.
                const sortedExpiries = expiryDataBySymbol[symbol].sort((a, b) => new Date(a.replace(/(\d{2})([A-Z]{3})(\d{4})/, '$2 $1, $3')) - new Date(b.replace(/(\d{2})([A-Z]{3})(\d{4})/, '$2 $1, $3')));
                const nearestTwo = sortedExpiries.slice(0, 2);

                // Store only the nearest two expiries in the database for the frontend to use.
                await Expiry.findOneAndUpdate(
                    { symbol: symbol },
                    { expiryDates: nearestTwo },
                    { upsert: true, new: true }
                );

                // Add the nearest two contracts to our in-memory list for fetching
                if(nearestTwo[0]) newContracts.push({ symbol, expiryDate: nearestTwo[0], position: 1 });
                if(nearestTwo[1]) newContracts.push({ symbol, expiryDate: nearestTwo[1], position: 2 });
            }
            
            activeContracts = newContracts;
            console.log(`Successfully updated expiry data. Now tracking ${activeContracts.length} nearest contracts.`);
        } else {
            throw new Error("Could not find expiry data in MCX HTML response.");
        }
    } catch (error) {
        console.error("CRITICAL: Failed to update expiry data list.", error.message);
    }
};

/**
 * Fetches live option chain data directly from the MCX endpoint.
 * This function uses the exact fetching logic you provided.
 */
const fetchThirdPartyMCXData = async (symbol, expiryDate) => {
    try {
        const url = "https://www.mcxindia.com/backpage.aspx/GetOptionChain";
        const body = { "Commodity": symbol, "Expiry": expiryDate };
        const headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Content-Type": "application/json",
            "Origin": "https://www.mcxindia.com",
            "Referer": "https://www.mcxindia.com/market-data/option-chain",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest"
        };

        const response = await axios.post(url, body, { headers });

        if (!response.data || !response.data.d || !response.data.d.Data) {
            throw new Error("Invalid response format from MCX endpoint");
        }
        
        let totalCE_OI = 0;
        let totalPE_OI = 0;

        response.data.d.Data.forEach(option => {
            totalCE_OI += option.CE_OpenInterest || 0;
            totalPE_OI += option.PE_OpenInterest || 0;
        });

        return { callOI: totalCE_OI, putOI: totalPE_OI };

    } catch (error) {
        console.error(`API Error fetching ${symbol} ${expiryDate}:`, error.message);
        throw error;
    }
};

/**
 * Iterates through active contracts, gets their OI data, and stores it in the correct collection.
 * This version uses the efficient daily document storage model.
 */
const fetchDataAndStore = async () => {
    if (activeContracts.length === 0) {
        console.warn("Skipping data fetch cycle: active contract list is empty.");
        return;
    }
    console.log(`Running scheduled job: Fetching OI data for ${activeContracts.length} contracts...`);
    
    for (const contract of activeContracts) {
        const { symbol, expiryDate, position } = contract;
        try {
            const oiTotals = await fetchThirdPartyMCXData(symbol, expiryDate);
            if (!oiTotals) continue;

            const OIDataModel = getOIDataModel(symbol);
            const today = new Date().toISOString().split('T')[0]; // Get date as "YYYY-MM-DD"

            const newDataPoint = {
                value: oiTotals.callOI - oiTotals.putOI,
                timestamp: new Date()
            };

            const pushField = `expiry${position}.data`;
            const expiryDateField = `expiry${position}.expiryDate`;

            await OIDataModel.findOneAndUpdate(
                { date: today },
                { 
                    $push: { [pushField]: newDataPoint },
                    $set: { [expiryDateField]: expiryDate }
                },
                { upsert: true }
            );

            console.log(`Updated data for ${symbol} - ${expiryDate}`);
        } catch (error) {
            console.error(`Skipping contract ${symbol} - ${expiryDate} due to fetch error.`);
        }
    }
};

/**
 * Initializes and starts all cron job schedulers.
 */
const startScheduler = async () => {
    await updateActiveContractsList();
    cron.schedule('0 8 * * *', updateActiveContractsList, { timezone: "Asia/Kolkata" });
    console.log('Scheduled daily job: Expiry list will be updated every day at 8:00 AM.');
    cron.schedule('* * * * *', fetchDataAndStore, { timezone: "Asia/Kolkata" });
    console.log('Scheduled per-minute job: OI data will be fetched and stored every minute.');
};

module.exports = { startScheduler };
