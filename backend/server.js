const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/db.js');
const { startScheduler } = require('./scheduler/fetcher.js');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middlewares
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Body parser for JSON

// Define API routes
app.use('/api/data', require('./routes/data.routes.js'));

// --- Serve Frontend ---
// This serves the built frontend files. In development, you might run frontend and backend separately.
// For production, you would build your frontend and place the files in a 'build' folder.
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../frontend', 'index.html'));
});


// Start the data fetching scheduler
startScheduler();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
