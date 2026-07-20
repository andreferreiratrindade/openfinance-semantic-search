const { QdrantClient } = require("@qdrant/js-client-rest");
const { pipeline } = require("@huggingface/transformers");
require('dotenv').config();
// ----------------------
// Configuration
// ----------------------

// Safely loading credentials from environment variables
const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || "YOUR_QDRANT_URL",
    apiKey: process.env.QDRANT_API_KEY || "YOUR_QDRANT_API_KEY",
});

const COLLECTION = "openfinance";

async function testRetrieval() {
    console.log("Loading multilingual embedding model...");

    // MUST match the model used for ingestion perfectly
    const embedder = await pipeline(
        "feature-extraction",
        "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
    );

    const query = "Conceitos e diferenças entre a instituição detentora de conta e a prestadora de serviço de iniciação de transação de pagamento (ITP) no âmbito do Open Finance";
    console.log(`\nGenerating embedding for query: "${query}"`);

    try {
        const embedding = await embedder(query, {
            pooling: "mean",
            normalize: true,
        });

        const queryVector = Array.from(embedding.data);

        console.log("Searching Qdrant collection...\n");

        const results = await qdrant.search(COLLECTION, {
            vector: queryVector,
            limit: 3, // Top-K results
            with_payload: true,
            with_vector: false, // We don't need the vector returned, just the payload
        });

        console.log("================ SEARCH RESULTS ================\n");

        results.forEach((res, index) => {
            console.log(`Result #${index + 1}`);
            console.log(`Score:  ${res.score.toFixed(4)}`);
            console.log(`Title:  ${res.payload.title}`);
            console.log(`URL:    ${res.payload.url}`);

            // Print a snippet of the text to verify the context
            const snippet = res.payload.text_content.length > 200
                ? res.payload.text_content.substring(0, 200) + "..."
                : res.payload.text_content;

            console.log(`Text:   ${snippet}\n`);
            console.log("------------------------------------------------");
        });

    } catch (err) {
        console.error("Search failed:", err.message);
    }
}

testRetrieval().catch(console.error);
