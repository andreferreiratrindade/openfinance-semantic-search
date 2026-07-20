const fs = require('fs');
const path = require('path');
const natural = require('natural');

// Directories for input and output JSON files
const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

// Chunking configuration
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 150;

// Common Portuguese abbreviations to prevent false sentence boundaries
// e.g. "O Sr. Silva disse..." should not split after "Sr."
const ptAbbreviations = [
  // Titles
  'sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'profa', 'eng', 'arq',

  // Addresses
  'av', 'r', 'rua', 'rod', 'al', 'tv', 'est', 'pc', 'pca', 'lgo',
  'vl', 'cond', 'bl', 'ap', 'apto', 'cj', 'sl',

  // Business
  'cia', 'ltda', 'mei', 'eireli', 'sa', 'sas', 'me', 'epp',

  // Government
  'gov', 'dep', 'sen', 'pref', 'ver', 'min', 'sec',

  // Military
  'gen', 'cel', 'ten', 'maj', 'cap', 'sgt', 'cb',

  // Documents
  'cpf', 'cnpj', 'rg', 'cnh', 'cep', 'ie', 'nf', 'nfe',

  // References
  'art', 'arts', 'inc', 'incs', 'par', 'pars', 'cap', 'caps',
  'vol', 'ed', 'eds', 'fig', 'figs', 'tab', 'tabs',
  'pag', 'pags', 'pág', 'págs', 'num', 'n', 'no',

  // Common Latin
  'etc', 'ex', 'cf', 'ie', 'eg', 'obs',

  // Time
  'h', 'hs', 'hr', 'hrs', 'min', 'mins', 'seg', 's',

  // Units
  'kg', 'g', 'mg', 'mcg', 'l', 'ml',
  'cm', 'mm', 'm', 'km',
  'm2', 'm3',

  // Currency
  'rs', 'r$', 'mil', 'mi', 'bi',

  // Internet / Chat
  'vc', 'vcs', 'pq', 'q', 'tb', 'td',
  'obg', 'obgd', 'obgda', 'pf', 'msg', 'att',

  // Months
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'
];

// Initialize the NLP Sentence Tokenizer [cite: 1.2.2]
const tokenizer = new natural.SentenceTokenizer(ptAbbreviations);

if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

function cleanText(text) {
    if (!text) return "";
    return text
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Splits text into chunks by keeping complete sentences together.
 */
function chunkTextNLP(text, targetSize, targetOverlap) {
    if (!text) return [];

    // 1. NLP breaks the text into an array of complete sentences
    const sentences = tokenizer.tokenize(text);

    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceLength = sentence.length;

        // If adding this sentence exceeds the target size, save the chunk
        if (currentLength + sentenceLength > targetSize && currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));

            // Build the overlap: grab sentences from the end of the chunk
            // until we reach the target overlap size
            let overlapArray = [];
            let overlapLength = 0;

            for (let j = currentChunk.length - 1; j >= 0; j--) {
                const prevSentence = currentChunk[j];
                // Keep at least one sentence for overlap, then stop if we hit the limit
                if (overlapLength + prevSentence.length <= targetOverlap || overlapArray.length === 0) {
                    overlapArray.unshift(prevSentence);
                    overlapLength += prevSentence.length + 1; // +1 for the space
                } else {
                    break;
                }
            }

            // Start the next chunk with the overlap + the current sentence
            currentChunk = [...overlapArray, sentence];
            currentLength = overlapLength + sentenceLength;
        } else {
            // Otherwise, keep building the current chunk
            currentChunk.push(sentence);
            currentLength += sentenceLength + (currentChunk.length > 1 ? 1 : 0);
        }
    }

    // Push whatever is left over
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
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

            const sanitizedText = cleanText(rawText);

            // Chunk using the NLP approach
            const chunks = chunkTextNLP(sanitizedText, CHUNK_SIZE, CHUNK_OVERLAP);

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

console.log('Starting NLP chunk process...');
processFiles();
console.log('Process complete!');
