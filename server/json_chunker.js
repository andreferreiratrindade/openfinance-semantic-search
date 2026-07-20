const fs = require('fs');
const path = require('path');

// Directories for input and output JSON files
const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

// Chunking configuration
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 150;

if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * Cleans the text by removing newlines, tabs, and multiple spaces.
 */
function cleanText(text) {
    if (!text) return "";
    return text
        // Replace newlines and tabs with a single space
        .replace(/[\r\n\t]+/g, ' ')
        // Replace multiple consecutive spaces with a single space
        .replace(/\s{2,}/g, ' ')
        // Trim leading and trailing spaces
        .trim();
}

function chunkText(text, size, overlap) {
    if (!text) return [];
    const chunks = [];
    let i = 0;

    while (i < text.length) {
        let end = i + size;

        if (end < text.length) {
            let spaceIndex = text.lastIndexOf(' ', end);
            if (spaceIndex > i + (size / 2)) {
                end = spaceIndex;
            }
        }

        chunks.push(text.substring(i, end).trim());
        i = end - overlap;
        if (i >= end) i = end;
    }
    return chunks;
}

function processFiles() {
    const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.json'));

    if (files.length === 0) {
        console.log('No JSON files found in the input directory.');
        return;
    }

    files.forEach(file => {
        const filePath = path.join(inputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        try {
            const data = JSON.parse(content);
            const rawText = data.texto || "";

            // 1. Clean the text before chunking
            const sanitizedText = cleanText(rawText);

            // 2. Chunk the cleaned text
            const chunks = chunkText(sanitizedText, CHUNK_SIZE, CHUNK_OVERLAP);

            chunks.forEach((chunk, index) => {
                const newFileName = `${path.parse(file).name}_chunk_${index + 1}.json`;
                const newFilePath = path.join(outputDir, newFileName);

                const newData = {
                    ...data,
                    texto: chunk
                };

                fs.writeFileSync(newFilePath, JSON.stringify(newData, null, 2), 'utf-8');
                console.log(`Created: ${newFileName} (Length: ${chunk.length} chars)`);
            });
        } catch (err) {
            console.error(`Error processing file ${file}:`, err.message);
        }
    });
}

console.log('Starting chunk process...');
processFiles();
console.log('Process complete!');
