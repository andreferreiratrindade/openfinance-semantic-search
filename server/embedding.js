const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('@huggingface/transformers');

// --- CONFIGURAÇÕES ---
const inputDir = path.join(__dirname, 'input');
const exportDir = path.join(__dirname, 'src', 'data');

// Configuração de Chunking
const TEXT_CHUNK_SIZE = 800; // Pode subir para 1200 se quiser mais contexto para o Llama
const TEXT_CHUNK_OVERLAP = 150; 
const E5_PREFIX = "passage: "; 

// Configuração de Exportação
const EXPORT_BATCH_SIZE = 100;

// Inicializa a API Nativa de Segmentação para Português
const segmenter = new Intl.Segmenter('pt-BR', { granularity: 'sentence' });

// Garante que os diretórios existam
if (!fs.existsSync(inputDir)) {
    fs.mkdirSync(inputDir, { recursive: true });
}
if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
}

// --- FUNÇÕES AUXILIARES ---
function cleanText(text) {
    if (!text) return "";
    return text
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function chunkTextNative(text, targetSize, targetOverlap) {
    if (!text) return [];

    const segments = Array.from(segmenter.segment(text));
    const sentences = segments.map(s => s.segment.trim()).filter(s => s.length > 0);

    const chunks = [];
    let currentChunk = [];
    let currentLength = 0;

    for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i];
        const sentenceLength = sentence.length;

        if (currentLength + sentenceLength > targetSize && currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));

            let overlapArray = [];
            let overlapLength = 0;

            for (let j = currentChunk.length - 1; j >= 0; j--) {
                const prevSentence = currentChunk[j];
                if (overlapLength + prevSentence.length <= targetOverlap || overlapArray.length === 0) {
                    overlapArray.unshift(prevSentence);
                    overlapLength += prevSentence.length + 1;
                } else {
                    break;
                }
            }

            currentChunk = [...overlapArray, sentence];
            currentLength = overlapLength + sentenceLength;
        } else {
            currentChunk.push(sentence);
            currentLength += sentenceLength + (currentChunk.length > 1 ? 1 : 0);
        }
    }

    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    return chunks;
}

// --- FLUXO PRINCIPAL ---
async function buildRAGDatabase() {
    console.log("📥 Carregando modelo de embeddings (e5-small, q8)...");
    const embedder = await pipeline("feature-extraction", "Xenova/multilingual-e5-small", { dtype: "q8" });

    const files = fs.readdirSync(inputDir).filter(file => file.endsWith('.json'));

    if (files.length === 0) {
        console.log("❌ Nenhum arquivo JSON encontrado no diretório de input.");
        return;
    }

    const bundledPoints = [];
    let fileCount = 0;

    console.log("⚙️ Iniciando processamento de texto e vetorização...");

    for (const file of files) {
        fileCount++;
        const filePath = path.join(inputDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');

        try {
            const data = JSON.parse(content);
            const rawText = data.texto || data.text_content || "";
            const sanitizedText = cleanText(rawText);

            // Quebra o texto usando a API nativa
            const chunks = chunkTextNative(sanitizedText, TEXT_CHUNK_SIZE, TEXT_CHUNK_OVERLAP);

            console.log(`📄 [${fileCount}/${files.length}] Processando ${file} -> Gerou ${chunks.length} chunks.`);

            for (let i = 0; i < chunks.length; i++) {
                const chunkText = chunks[i];
                
                // O prefixo "passage: " é injetado apenas para o cálculo do vetor
                const textToEmbed = E5_PREFIX + chunkText;
                const embedding = await embedder(textToEmbed, { pooling: "mean", normalize: true });

                bundledPoints.push({
                    id: `${path.parse(file).name}_chunk_${i + 1}_${crypto.randomUUID().slice(0, 8)}`, // ID único legível
                    text_content: chunkText, // Salva o texto LIMPO para a UI ler
                    title: data.title || "Exibe Normativo",
                    url: data.url || "",
                    paginaId: data.paginaId || "",
                    source_file: file, // Crucial para o Small-to-Big Retrieval
                    chunk_index: i + 1, // Crucial para o Small-to-Big Retrieval
                    vector: Array.from(embedding.data)
                });
            }
        } catch (err) {
            console.error(`⚠️ Erro ao processar o arquivo ${file}:`, err.message);
        }
    }

    console.log("\n💾 Exportando arquivos de partição para RxDB...");

    let batchCount = 0;
    for (let i = 0; i < bundledPoints.length; i += EXPORT_BATCH_SIZE) {
        const slice = bundledPoints.slice(i, i + EXPORT_BATCH_SIZE);
        const jsContent = `export const chunksData = ${JSON.stringify(slice, null, 2)};`;

        const fileName = `data_${batchCount}.js`;
        fs.writeFileSync(path.join(exportDir, fileName), jsContent);

        console.log(`✅ Salvo: ${fileName} com ${slice.length} vetores.`);
        batchCount++;
    }

    console.log(`\n🎉 Sucesso! ${bundledPoints.length} vetores totais empacotados em ${batchCount} arquivos JS em ${exportDir}`);
}

buildRAGDatabase().catch(console.error);