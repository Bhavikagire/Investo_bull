const express = require('express');
const fs = require('fs');
const path = require('path'); // Import the 'path' module

const app = express();
const PORT = 8000;

const jsonFilePath = path.join(__dirname, './priceData.json'); 

app.get('/', (req, res) => {
    res.send('Stock Analysis API is running!');
});

app.get('/readJson', (req, res) => {
    try {
        // Read the JSON file from the priceData 
        const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
        
        // Parse the JSON data
        const parsedData = JSON.parse(jsonData);

        // For now, we'll just send the JSON data as the response
        res.json(parsedData);
    } catch (error) {
        console.error('Error reading JSON file:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Endpoint to find the time of the first Opening Range Breakout (ORB) candle

app.get('/findORB/:minutes', (req, res) => {
    try {
        const minutes = parseInt(req.params.minutes);

        // Ensure that minutes is a positive integer
        if (isNaN(minutes) || minutes <= 0) {
            return res.status(400).send('Invalid input. Please provide a positive integer for minutes.');
        }

        const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
        const candles = JSON.parse(jsonData).candles;

        // Get the Opening Range candles
        const openingRangeCandles = candles.slice(0, minutes / 5);

        // Calculate the range (highest high and lowest low)
        const range = {
            high: Math.max(...openingRangeCandles.map(candle => parseFloat(candle.High))),
            low: Math.min(...openingRangeCandles.map(candle => parseFloat(candle.Low)))
        };

        let orbCandleFound = false;

        // Find the first candle that closes after the specified minutes
        const orbCandle = candles.find(candle => {
            const close = parseFloat(candle.Close);
            const candleTime = new Date(candle.LastTradeTime).getTime();
            
            if (!orbCandleFound && (close > range.high || close < range.low || candleTime >= openingRangeCandles[openingRangeCandles.length - 1].LastTradeTime)) {
                orbCandleFound = true;
                return true;
            }
            
            return false;
        });

        if (orbCandle) {
            res.json({ ORBCandleGeneratedAt: orbCandle.LastTradeTime });
        } else {
            res.json({ message: 'No Opening Range Breakout found within the specified minutes.' });
        }
    } catch (error) {
        console.error('Error finding ORB candle:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/generateCombinedCandles/:interval', (req, res) => {
    try {
        const interval = parseInt(req.params.interval);

        if (isNaN(interval) || interval <= 0) {
            return res.status(400).send('Invalid input. Please provide a positive integer for interval.');
        }

        const jsonData = fs.readFileSync(jsonFilePath, 'utf-8');
        const candles = JSON.parse(jsonData).candles;

        const combinedCandles = [];
        const candlesPerGroup = Math.floor(interval / 5); // each candle represents 5 minutes

        for (let i = 0; i < candles.length; i += candlesPerGroup) {
            const group = candles.slice(i, i + candlesPerGroup);

            if (group.length > 0) {
                const firstCandle = group[0];
                const lastCandle = group[group.length - 1];

                const combinedCandle = {
                    id: combinedCandles.length,
                    low: Math.min(...group.map(c => parseFloat(c.Low))),
                    tradedQty: group.reduce((total, c) => total + parseInt(c.TradedQty), 0),
                    close: lastCandle.Close,
                    lastTradeTime: lastCandle.LastTradeTime,
                    high: Math.max(...group.map(c => parseFloat(c.High))),
                    quotationLot: 1,
                    open: firstCandle.Open,
                    openInterest: 0
                };

                combinedCandles.push(combinedCandle);
            }
        }

        res.json(combinedCandles);
    } catch (error) {
        console.error('Error generating combined candles:', error);
        res.status(500).send('Internal Server Error');
    }
});


app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
