const fs = require('fs');
const path = require('path');
const { pipeline } = require('@huggingface/transformers');

async function bundleData() {
    console.log("Loading embedding model...");
    // 1. Swap to e5-small and explicitly lock precision to q8
    const embedder = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" });

    const dataDirectory = path.join(__dirname, 'output');
    const files = fs.readdirSync(dataDirectory).filter(f => f.endsWith('.json'));

    const bundledPoints = [];
    var count =0;
    for (const file of files) {
        count++;
        console.log(`Processing file ${count}: ${file}`);

        const rawContent = JSON.parse(fs.readFileSync(path.join(dataDirectory, file), 'utf8'));
        const items = Array.isArray(rawContent) ? rawContent : [rawContent];

        for (const item of items) {
            const text = item.text_content || item.texto || "";

            // 2. CRITICAL: e5 models require the "passage: " prefix for database documents
            const textToEmbed = "passage: " + text;

            // Generate the vector using the prefixed text
            const embedding = await embedder(textToEmbed, { pooling: "mean", normalize: true });

            bundledPoints.push({
                id: item.id || require('uuid').v4(),
                text_content: text, // Store the clean text (without the prefix) for the UI
                title: item.title || "Exibe Normativo",
                url: item.url || "",
                paginaId: item.paginaId || "",
                vector: Array.from(embedding.data)
            });
        }
        console.log(`Processed ${file}`);
    }

    // 3. Save into multiple files containing exactly 100 objects each
    const CHUNK_SIZE = 100;
    const outputDir = path.join(__dirname, 'src', 'data');

    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    let fileCount = 0;
    for (let i = 0; i < bundledPoints.length; i += CHUNK_SIZE) {
        const slice = bundledPoints.slice(i, i + CHUNK_SIZE);
        const jsContent = `export const chunksData = ${JSON.stringify(slice)};`;

        const fileName = `data_${fileCount}.js`;
        fs.writeFileSync(path.join(outputDir, fileName), jsContent);

        console.log(`Saved ${fileName} with ${slice.length} points.`);
        fileCount++;
    }

    console.log(`Success! ${bundledPoints.length} total points bundled into ${fileCount} files.`);
}

bundleData().catch(console.error);
