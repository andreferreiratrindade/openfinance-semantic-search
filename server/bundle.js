const fs = require('fs');
const path = require('path');
const { pipeline } = require('@huggingface/transformers');

async function bundleData() {
    console.log("Loading embedding model...");
    const embedder = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2");

    const dataDirectory = path.join(__dirname, 'output');
    const files = fs.readdirSync(dataDirectory).filter(f => f.endsWith('.json'));

    const bundledPoints = [];

    for (const file of files) {
        const rawContent = JSON.parse(fs.readFileSync(path.join(dataDirectory, file), 'utf8'));
        const items = Array.isArray(rawContent) ? rawContent : [rawContent];

        for (const item of items) {
            const text = item.text_content || item.texto || "";

            // 1. Generate the vector
            const embedding = await embedder(text, { pooling: "mean", normalize: true });

            // 2. Build the exact object structure your RxDB expects
            bundledPoints.push({
                id: item.id || require('uuid').v4(),
                text_content: text,
                title: item.title || "Exibe Normativo",
                url: item.url || "",
                paginaId: item.paginaId || "",
                vector: Array.from(embedding.data) // THIS adds the vector!
            });
        }
        console.log(`Processed ${file}`);
    }

    // 3. Write to data.js
    const jsContent = `export const chunksData = ${JSON.stringify(bundledPoints)};`;
    fs.writeFileSync('data.js', jsContent);
    console.log(`Success! ${bundledPoints.length} points bundled into data.js`);
}

bundleData().catch(console.error);
