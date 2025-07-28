const dataContainer = document.getElementById('data-container');
const lastUpdatedElement = document.getElementById('last-updated');
const symbolSelect = document.getElementById('symbol-select');
const expirySelect = document.getElementById('expiry-select');
const chartCanvas = document.getElementById('oi-chart');
const resetZoomBtn = document.getElementById('reset-zoom-btn');

let chartInstance;

const populateSelect = (selectElement, options) => {
    selectElement.innerHTML = '';
    options.forEach(optionValue => {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        selectElement.appendChild(option);
    });
};

export const populateSymbolSelect = (symbols) => populateSelect(symbolSelect, symbols);
export const populateExpirySelect = (expiries) => populateSelect(expirySelect, expiries);

export const updateLatestDataPointDisplay = (latestData) => {
    if (!latestData) {
        dataContainer.innerHTML = `<p class="text-center text-gray-400">Waiting for live data...</p>`;
        return;
    }
    const oiDiffColor = latestData.oiDifference >= 0 ? 'text-green-400' : 'text-red-400';
    dataContainer.innerHTML = `
        <div class="text-center">
            <p class="text-sm text-gray-400">Live OI Difference</p>
            <p class="text-3xl font-bold ${oiDiffColor}">${latestData.oiDifference.toLocaleString('en-IN')}</p>
        </div>
    `;
};

export const renderChart = (dataPoints) => {
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = dataPoints.map(p => new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    const data = dataPoints.map(p => p.value); // The historical data has 'value' field

    chartInstance = new Chart(chartCanvas, {
        type: 'line',
        data: { labels, datasets: [{
            label: 'CE OI - PE OI', data, borderWidth: 2, pointRadius: 1,
            segment: { borderColor: ctx => (ctx.p1.raw >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)') }
        }]},
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255, 255, 255, 0.1)' } }
            },
            plugins: {
                legend: { display: false },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' }
                }
            }
        }
    });
    resetZoomBtn.onclick = () => chartInstance?.resetZoom();
};

/**
 * Adds a single new data point to the end of the chart without redrawing everything.
 * @param {number} oiDifference The new OI difference value.
 */
export const addLivePointToChart = (oiDifference) => {
    if (!chartInstance) return;

    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    chartInstance.data.labels.push(timeLabel);
    chartInstance.data.datasets[0].data.push(oiDifference);
    
    // Update the chart efficiently
    chartInstance.update();
};


export const setLoadingState = (isLoading) => {
    if (isLoading) {
        dataContainer.innerHTML = `<div class="flex justify-center items-center h-full"><div class="loader"></div></div>`;
    }
};

export const updateTimestamp = () => {
    lastUpdatedElement.textContent = `Last Updated: ${new Date().toLocaleTimeString()}`;
};
