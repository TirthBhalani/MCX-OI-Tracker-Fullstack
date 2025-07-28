const mongoose = require('mongoose');

const ExpirySchema = new mongoose.Schema({
    // The symbol name, e.g., "GOLD". This will be unique.
    symbol: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    // An array of expiry date strings for that symbol.
    expiryDates: [{
        type: String
    }]
});

module.exports = mongoose.model('Expiry', ExpirySchema);
