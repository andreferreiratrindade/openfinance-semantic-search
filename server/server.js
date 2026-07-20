const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const port = 3000;

// Enable CORS so your local HTML file can talk to this server
app.use(cors());
// Parse incoming JSON payloads
app.use(express.json());
console.log("Initializing MongoDB Client...");
console.log(process.env.MONGODB_URI);
// Initialize MongoDB Client
const client = new MongoClient(process.env.MONGODB_URI);

app.get('/api/search', async (req, res) => {
  const { query } = req.query; ;
  console.log(`Received search request for query: "${query}"`);
  if (!query) {
    return res.status(400).json({ error: "Query string is required" });
  }

  try {
    await client.connect();
    const collection = client.db("openfinance").collection("openfinance");

    console.log(`Searching MongoDB for: "${query}"`);

    // Using MongoDB Atlas Automated Embedding
    const results = await collection.aggregate([
      {
        "$vectorSearch": {
          "index": "autoembed_index", // Must match your Atlas index name exactly
          "path": "text_content",
          "query": query,              // The text string, embedded automatically by Atlas
          "numCandidates": 100,
          "limit": 3
        }
      }
    //   ,
    //   {
    //     "$project": {
    //       "text_content": 1,
    //       "title": 1,
    //       "url": 1,
    //       "score": { "$meta": "vectorSearchScore" }
    //     }
    //   }
    ]).toArray();

    console.log(`Found ${results.length} results for query: "${query}"`);
    console.log(results);

    // Combine the text from the top results into a single context block
    // const context = results.map(doc => {
    //   return `Source: ${doc.title || 'Unknown'}\nURL: ${doc.url || 'N/A'}\nContent: ${doc.text_content}`;
    // }).join("\n\n---\n\n");

    res.json( results );

  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Failed to query the database" });
  } finally {
    // Note: In a production app, you would keep the connection open,
    // but for local testing, opening/closing per request is fine.
    await client.close();
  }
});

app.listen(port, () => {
  console.log(`Local vector search backend running at http://localhost:${port}`);
});
