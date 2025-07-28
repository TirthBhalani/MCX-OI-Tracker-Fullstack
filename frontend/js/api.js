import { API_BASE_URL } from './config.js';

/**
 * Fetches all symbols and their associated expiry dates from OUR backend.
 * @returns {Promise<object[]>} A promise resolving to an array like [{ symbol: 'GOLD', expiryDates: [...] }]
 */
export const fetchAllExpiries = async () => {
    try {
        const response = await fetch(`${API_BASE_URL}/expiries`);
        if (!response.ok) throw new Error(`HTTP error fetching expiries! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch expiry data:", error);
        return [];
    }
};

/**
 * Fetches all of today's stored HISTORICAL chart data from OUR backend.
 * @param {string} symbol The commodity symbol.
 * @returns {Promise<object>} A promise that resolves to the daily data document.
 */
export const fetchTodaysChartData = async (symbol) => {
    try {
        const response = await fetch(`${API_BASE_URL}/today?symbol=${symbol}`);
        if (!response.ok) throw new Error(`HTTP error fetching chart data! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch today's chart data:", error);
        return {};
    }
};

/**
 * Fetches the LIVE, real-time OI data point by calling our backend proxy.
 * This solves the CORS issue.
 * @param {string} symbol The commodity symbol.
 * @param {string} expiryDate The selected expiry date.
 * @returns {Promise<object>} A promise resolving to { callOI, putOI }.
 */
export const fetchLiveMCXData = async (symbol, expiryDate) => {
    try {
        // Call our own backend's proxy endpoint instead of MCX directly
        const response = await fetch(`${API_BASE_URL}/live?symbol=${symbol}&expiryDate=${expiryDate}`);

        if (!response.ok) throw new Error(`Live data proxy error! Status: ${response.status}`);

        const jsonData = await response.json();
        if (!jsonData?.d?.Data) throw new Error("Invalid live response format from proxy");

        let totalCE_OI = 0, totalPE_OI = 0;
        jsonData.d.Data.forEach(option => {
            totalCE_OI += option.CE_OpenInterest || 0;
            totalPE_OI += option.PE_OpenInterest || 0;
        });

        return { callOI: totalCE_OI, putOI: totalPE_OI };

    } catch (error) {
        console.error(`Failed to fetch live MCX data for ${symbol} ${expiryDate}:`, error);
        return null; // Return null on error
    }
};
