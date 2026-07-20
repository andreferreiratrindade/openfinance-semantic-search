const express = require('express');
const cors = require('cors');
const { QdrantClient } = require('@qdrant/js-client-rest');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

console.log("Initializing Qdrant Client...");
const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});



app.post('/api/search', async (req, res) => {
  const { vector } = req.body;
  console.log(`Received search request for vector: ${vector}`);

  if (!vector) {
    return res.status(400).json({ error: "Vector is required" });
  }

  try {

    const results = await client.search("openfinance", {
            vector: vector,
            limit: 5, // Adjust this limit based on your WebLLM context window limits
            with_payload: true,
            with_vector: false // We don't need to send the vectors back to the browser
        });

    console.log(`Found ${results.length} results.`);

    res.json(results);

  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to query the database" });
  }
});

app.listen(port, () => {
  console.log(`Local Qdrant vector search backend running at http://localhost:${port}`);
});
