const fs = require('fs');
const path = require('path');

// Diretórios
const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

// Configuração de Chunking Otimizada para Modelos E5 (Limite de 512 Tokens)
// 800 caracteres = aprox. 130-160 palavras (muito seguro para 512 tokens)
const CHUNK_SIZE = 800; 
const CHUNK_OVERLAP = 150; 
const E5_PREFIX = "passage: "; // Prefixo OBRIGATÓRIO para indexação no e5-base/small

// Inicializa a API Nativa de Segmentação para Português
// Substitui a biblioteca 'natural' e a lista gigante de abreviações
const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'sentence' });

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
 * Quebra o texto respeitando os limites das frases utilizando API nativa.
 */
function chunkTextNative(text, targetSize, targetOverlap) {
    if (!text) return [];

    // Extrai as frases do texto de forma nativa e precisa
    const segments = Array.from(segmenter.segment(text));
    const sentences = segments.map(s => s.segment.trim()).filter(s => s.length > 0);

    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceLength = sentence.length;

        // Se a frase atual estourar o limite desejado
        if (currentLength + sentenceLength > targetSize && currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));

            // Constrói o overlap (sobreposição) com as últimas frases
            let overlapArray = [];
            let overlapLength = 0;

            for (let j = currentChunk.length - 1; j >= 0; j--) {
                const prevSentence = currentChunk[j];
                if (overlapLength + prevSentence.length <= targetOverlap || overlapArray.length === 0) {
                    overlapArray.unshift(prevSentence);
                    overlapLength += prevSentence.length + 1; // +1 para considerar o espaço
                } else {
                    break;
                }
            }

            // Inicia o próximo chunk com a sobreposição + a frase atual
            currentChunk = [...overlapArray, sentence];
            currentLength = overlapLength + sentenceLength;
        } else {
            // Continua construindo o chunk
            currentChunk.push(sentence);
            currentLength += sentenceLength + (currentChunk.length > 1 ? 1 : 0);
        }
    }

    // Salva o último chunk restante
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    return chunks;
}

function processFiles() {
    const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.json'));

    if (files.length === 0) {
        console.log('Nenhum arquivo JSON encontrado no diretório de input.');
        return;
    }

    files.forEach(file => {
        const filePath = path.join(inputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        try {
            const data = JSON.parse(content);
            const rawText = data.texto || "";

            const sanitizedText = cleanText(rawText);

            // Realiza o chunking utilizando a nova função nativa
            const chunks = chunkTextNative(sanitizedText, CHUNK_SIZE, CHUNK_OVERLAP);

            // Array em lote para salvar em um único arquivo (muito mais rápido para o RxDB importar)
            const documentBatches = chunks.map((chunk, index) => {
                const passageText = `${E5_PREFIX}${chunk}`; // Injeta o prefixo E5 obrigatório
                
                return {
                    id: `${path.parse(file).name}_chunk_${index + 1}`,
                    source_file: file,
                    chunk_index: index + 1,
                    total_chunks: chunks.length,
                    texto: passageText,
                    original_metadata: data // preserva qualquer outra chave que veio do JSON original
                };
            });

            // Opcional: Em vez de gerar 50 arquivos minúsculos, salvamos 1 arquivo contendo um Array de chunks.
            // Isso facilita a importação em massa para o RxDB/IndexedDB depois.
            const newFileName = `${path.parse(file).name}_processed.json`;
            const newFilePath = path.join(outputDir, newFileName);

            fs.writeFileSync(newFilePath, JSON.stringify(documentBatches, null, 2), 'utf-8');
            console.log(`Processado: ${file} -> Gerou ${chunks.length} chunks seguros para WebGPU.`);

        } catch (err) {
            console.error(`Erro ao processar o arquivo ${file}:`, err.message);
        }
    });
}

console.log('Iniciando processamento nativo otimizado para WebGPU...');
processFiles();
console.log('Processo finalizado!');