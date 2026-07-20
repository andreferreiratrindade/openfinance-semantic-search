const { pipeline } = require('@huggingface/transformers');

// 1. Copy exactly ONE text string from your generated data.js file
const testText = "O texto de exemplo exato do seu banco de dados vai aqui.";

// 2. Copy the first 3 numbers of the vector attached to that text in data.js
const savedVector = [0.012345, -0.06789, 0.098765]; 

async function verifyDtype() {
    console.log("Loading Q8 model...");
    const embedderQ8 = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", { dtype: "q8" });
    const resQ8 = await embedderQ8(testText, { pooling: "mean", normalize: true });
    
    console.log("Loading FP32 model...");
    const embedderFp32 = await pipeline("feature-extraction", "Xenova/paraphrase-multilingual-MiniLM-L12-v2", { dtype: "fp32" });
    const resFp32 = await embedderFp32(testText, { pooling: "mean", normalize: true });

    const q8Start = Array.from(resQ8.data).slice(0, 3);
    const fp32Start = Array.from(resFp32.data).slice(0, 3);

    console.log("\n--- RESULTADOS ---");
    console.log("Vector Salvo (DB):", savedVector);
    console.log("Vector Q8:        ", q8Start);
    console.log("Vector FP32:      ", fp32Start);
    
    // Whichever one matches your saved vector is the dtype you used!
}

verifyDtype().catch(console.error);