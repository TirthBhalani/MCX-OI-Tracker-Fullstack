const express = require('express');
const router = express.Router();
const axios = require('axios'); // Import axios to make requests from the backend
const getOIDataModel = require('../models/oidata.model.js');
const Expiry = require('../models/expiry.model.js');

/**
 * @route   GET /api/data/expiries
 * @desc    Get all symbols and their stored expiry dates from the database
 * @access  Public
 */
router.get('/expiries', async (req, res) => {
    try {
        // Fetch all expiry documents and sort them by symbol name
        const allExpiries = await Expiry.find({}).sort({ symbol: 'asc' });
        res.json(allExpiries);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/**
 * @route   GET /api/data/today
 * @desc    Get the single daily document for a given symbol.
 * @access  Public
 */
router.get('/today', async (req, res) => {
    const { symbol } = req.query;
    if (!symbol) {
        return res.status(400).json({ msg: 'Symbol query parameter is required.' });
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const OIDataModel = getOIDataModel(symbol);
        const dailyData = await OIDataModel.findOne({ date: today });

        if (!dailyData) {
            // It's normal to have no data early in the day. Send an empty object.
            return res.json({});
        }
        res.json(dailyData);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

/**
 * @route   GET /api/data/live
 * @desc    Acts as a proxy to fetch live data from MCX, bypassing CORS issues.
 * @access  Public
 */
router.get('/live', async (req, res) => {
    const { symbol, expiryDate } = req.query;
    if (!symbol || !expiryDate) {
        return res.status(400).json({ msg: 'Symbol and expiryDate query parameters are required.' });
    }

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

        const mcxResponse = await axios.post(url, body, { headers });
        res.json(mcxResponse.data); // Forward the response to the frontend

    } catch (error) {
        console.error(`Proxy Error fetching live data for ${symbol} ${expiryDate}:`, error.message);
        res.status(502).json({ msg: 'Failed to fetch data from MCX.' }); // 502 Bad Gateway
    }
});


module.exports = router;
