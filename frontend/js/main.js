import { fetchAllExpiries, fetchTodaysChartData, fetchLiveMCXData } from './api.js';
import { 
    populateSymbolSelect, 
    populateExpirySelect, 
    updateLatestDataPointDisplay,
    renderChart,
    addLivePointToChart,
    setLoadingState, 
    updateTimestamp
} from './ui.js';

const symbolSelect = document.getElementById('symbol-select');
const expirySelect = document.getElementById('expiry-select');

let liveDataInterval;
let allExpiriesData = [];

/**
 * This function is called every minute by the user's browser.
 * It fetches the LIVE data point from MCX and updates the UI.
 */
const refreshLiveData = async () => {
    const currentSymbol = symbolSelect.value;
    const currentExpiry = expirySelect.value;
    if (!currentSymbol || !currentExpiry) return;

    console.log("Fetching live data point...");
    const liveData = await fetchLiveMCXData(currentSymbol, currentExpiry);

    if (liveData) {
        const oiDifference = liveData.callOI - liveData.putOI;
        
        // Update the main data card
        updateLatestDataPointDisplay({ oiDifference });
        
        // Add the new point to the chart
        addLivePointToChart(oiDifference);
    }
    
    updateTimestamp();
};

/**
 * This function is called only when the symbol or expiry changes.
 * It fetches the HISTORICAL data from our backend to draw the chart.
 */
const loadHistoricalData = async () => {
    const currentSymbol = symbolSelect.value;
    const currentExpiry = expirySelect.value;
    if (!currentSymbol || !currentExpiry) return;

    setLoadingState(true);
    try {
        const dailyDoc = await fetchTodaysChartData(currentSymbol);

        let dataPoints = [];
        if (dailyDoc.expiry1 && dailyDoc.expiry1.expiryDate === currentExpiry) {
            dataPoints = dailyDoc.expiry1.data || [];
        } else if (dailyDoc.expiry2 && dailyDoc.expiry2.expiryDate === currentExpiry) {
            dataPoints = dailyDoc.expiry2.data || [];
        }
        
        // Render the chart with the historical data
        renderChart(dataPoints);

    } catch (error) {
        console.error("Error loading historical data:", error);
        renderChart([]); // Render an empty chart on error
    }
    setLoadingState(false);
};

const handleSelectionChange = () => {
    // Stop the previous timer
    if (liveDataInterval) clearInterval(liveDataInterval);
    
    // Load the historical data for the new selection
    loadHistoricalData();
    
    // Fetch the first live point immediately
    refreshLiveData();
    
    // Start a new timer for live updates
    liveDataInterval = setInterval(refreshLiveData, 60000);
};

const handleSymbolChange = () => {
    const selectedSymbol = symbolSelect.value;
    const symbolData = allExpiriesData.find(item => item.symbol === selectedSymbol);
    
    if (symbolData && symbolData.expiryDates) {
        populateExpirySelect(symbolData.expiryDates);
    } else {
        populateExpirySelect([]);
    }
    
    handleSelectionChange();
};

const initialize = async () => {
    setLoadingState(true);
    allExpiriesData = await fetchAllExpiries();
    
    const symbols = allExpiriesData.map(item => item.symbol);
    populateSymbolSelect(symbols);
    
    symbolSelect.addEventListener('change', handleSymbolChange);
    expirySelect.addEventListener('change', handleSelectionChange);

    // Initial load
    handleSymbolChange();
};

document.addEventListener('DOMContentLoaded', initialize);
