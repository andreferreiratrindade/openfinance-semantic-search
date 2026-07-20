const fs = require('fs');
const path = require('path');

function splitExistingData() {
    const inputPath = path.join(__dirname, 'data.js');

    if (!fs.existsSync(inputPath)) {
        console.error("Error: Could not find data.js in this directory.");
        return;
    }

    console.log("Reading massive data.js file... (this may take a moment)");
    const rawContent = fs.readFileSync(inputPath, 'utf8').trim();

    // Isolate the JSON array by finding the first bracket '[' and the last bracket ']'
    const startIndex = rawContent.indexOf('[');
    const endIndex = rawContent.lastIndexOf(']') + 1;

    if (startIndex === -1 || endIndex === 0) {
        console.error("Error: Could not locate a valid data array inside the file.");
        return;
    }

    console.log("Extracting and parsing JSON structure...");
    const jsonString = rawContent.slice(startIndex, endIndex);
    const allData = JSON.parse(jsonString);

    console.log(`Success! Located ${allData.length} fully-embedded records.`);

    // Divide the array into 10 partitions
    const NUM_FILES = 10;
    const chunkSize = Math.ceil(allData.length / NUM_FILES);

    for (let i = 0; i < NUM_FILES; i++) {
        const start = i * chunkSize;
        const end = start + chunkSize;
        const chunk = allData.slice(start, end);

        if (chunk.length > 0) {
            // Re-wrap the sliced data into the expected ES module export format
            const jsContent = `export const chunksData = ${JSON.stringify(chunk)};\n`;
            const outputFilename = `data_${i}.js`;

            fs.writeFileSync(path.join(__dirname, outputFilename), jsContent);
            console.log(`-> Created ${outputFilename} (${chunk.length} items)`);
        }
    }

    console.log("\nPartitioning complete! You can safely deploy these 10 files to GitHub Pages.");
}

splitExistingData();
