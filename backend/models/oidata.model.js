const mongoose = require('mongoose');

// A sub-schema for a single time-stamped data point.
// We use { _id: false } because we don't need individual IDs for each data point.
const TimeSeriesPointSchema = new mongoose.Schema({
    value: { type: Number, required: true }, // The OI difference
    timestamp: { type: Date, required: true }
}, { _id: false });

// The main schema for a single daily record for a specific symbol.
const DailyOIDataSchema = new mongoose.Schema({
    // A string representation of the date, e.g., "2025-07-28"
    date: {
        type: String,
        required: true,
        unique: true, // Ensure only one document per day per symbol
        index: true
    },
    // An object to hold data for the nearest expiry contract
    expiry1: {
        expiryDate: String,
        data: [TimeSeriesPointSchema]
    },
    // An object to hold data for the second-nearest expiry contract
    expiry2: {
        expiryDate: String,
        data: [TimeSeriesPointSchema]
    }
});

const models = {};

/**
 * Dynamically creates or retrieves a Mongoose model for a given symbol.
 * This allows us to use a separate collection for each commodity (e.g., 'golds', 'silvers').
 * @param {string} symbol The commodity symbol (e.g., "GOLD").
 * @returns {mongoose.Model} The Mongoose model for that symbol's collection.
 */
const getOIDataModel = (symbol) => {
    // Sanitize the symbol name to be used as a collection name (e.g., "GOLD" -> "golds")
    const modelName = symbol.toLowerCase().replace(/[^a-z0-9]/gi, ''); 
    
    // If we haven't created this model yet, create and cache it using the new daily schema.
    if (!models[modelName]) {
        models[modelName] = mongoose.model(modelName, DailyOIDataSchema);
    }
    
    return models[modelName];
};

module.exports = getOIDataModel;
