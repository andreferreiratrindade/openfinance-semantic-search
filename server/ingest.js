const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const { QdrantClient } = require("@qdrant/js-client-rest");
require('dotenv').config();
const {
    pipeline,
} = require("@huggingface/transformers");

// ----------------------
// Configuration
// ----------------------

const qdrant = new QdrantClient({
    url: process.env.QDRANT_URL || "YOUR_QDRANT_URL",
    apiKey: process.env.QDRANT_API_KEY || "YOUR_QDRANT_API_KEY",
});

const COLLECTION = "openfinance";

const dataDirectory = path.join(__dirname, "output");

async function seedDatabase() {

    console.log("Loading embedding model...");

    // const embedder = await pipeline(
    //     "feature-extraction",
    //     "Xenova/all-MiniLM-L6-v2"
    // );
    const embedder = await pipeline(
        "feature-extraction",
        "Xenova/paraphrase-multilingual-MiniLM-L12-v2"
    );

    console.log("Embedding model loaded.");

    const files = fs.readdirSync(dataDirectory);
    const jsonFiles = files.filter(f => f.endsWith(".json"));

    const points = [];

    for (const file of jsonFiles) {

        const filePath = path.join(dataDirectory, file);

        let parsedData;

        try {

            parsedData = JSON.parse(
                fs.readFileSync(filePath, "utf8")
            );

        } catch (err) {

            console.error(file, err.message);
            continue;

        }

        if (!Array.isArray(parsedData))
            parsedData = [parsedData];

        for (const item of parsedData) {

            const text = item.texto ?? "";

            try {

                const embedding = await embedder(text, {
                    pooling: "mean",
                    normalize: true,
                });

                points.push({

                    id: uuid(),

                    vector: Array.from(embedding.data),

                    payload: {

                        text_content: text,

                        title: item.title,

                        url: item.url,

                        paginaId: item.paginaId

                    }

                });

                console.log(`Embedded: ${item.title}`);

            } catch (err) {

                console.error("Embedding failed:", err.message);

            }
        }
    }

    console.log(`Uploading ${points.length} points...`);

const BATCH_SIZE = 100;

for (let i = 0; i < points.length; i += BATCH_SIZE) {

    const batch = points.slice(i, i + BATCH_SIZE);

    console.log(
        `Uploading ${i + 1}-${Math.min(i + BATCH_SIZE, points.length)}`
    );

    await qdrant.upsert(COLLECTION, {
        wait: true,
        points: batch
    });
}

console.log("Done!");
}

seedDatabase().catch(console.error);
