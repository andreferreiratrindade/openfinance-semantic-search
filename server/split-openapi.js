
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const SwaggerParser = require('@apidevtools/swagger-parser');

const apiName = "payments_5.0.0"
// Configuration
const INPUT_FILE = `./api_regulatorias/${apiName}.yaml`; 
const OUTPUT_DIR = `./api_regulatorias/${apiName}`;        

/**
 * Creates a safe filename from an API path
 */
function sanitizePath(apiPath) {
    let clean = apiPath.replace(/^\//, ''); 
    clean = clean.replace(/\//g, '_');      
    clean = clean.replace(/[{}]/g, '');     
    return clean || 'root';
}

/**
 * Safely stringifies JSON containing circular references
 */
function getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
                return "[Circular Reference]";
            }
            seen.add(value);
        }
        return value;
    };
}

async function processOpenApi() {
    try {
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        console.log('Parsing and dereferencing OpenAPI file...');
        
        const api = await SwaggerParser.dereference(INPUT_FILE);
        const apiTitle = api.info?.title || 'Unknown API';
        console.log(`✅ Successfully dereferenced API: ${apiTitle}`);

        // Handle the Global Description
        if (api.info && api.info.description) {
            const descPath = path.join(OUTPUT_DIR, `${apiName}_description.json`);
            
            const descriptionWrapper = {
                texto: api.info.description, // Raw description text
                paginaId: crypto.randomUUID(),
                title: `${apiTitle} - Overview`,
                url: "/" // Root representation
            };

            fs.writeFileSync(descPath, JSON.stringify(descriptionWrapper, null, 2), 'utf8');
            console.log('✅ Saved global description to description.json');
        }

        // Handle the Endpoints
        if (api.paths) {
            const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'];
            let endpointCount = 0;

            for (const [apiPath, pathItem] of Object.entries(api.paths)) {
                for (const [method, operationDetails] of Object.entries(pathItem)) {
                    
                    if (validMethods.includes(method.toLowerCase())) {
                        const safeName = sanitizePath(apiPath);
                        const fileName = `${method.toUpperCase()}_${safeName}.json`;
                        const filePath = path.join(OUTPUT_DIR, `${apiName}_${fileName}`);

                        const stringifiedEndpoint = JSON.stringify(operationDetails, getCircularReplacer(), 2);
                        const endpointTitle = operationDetails.summary || operationDetails.operationId || `${method.toUpperCase()} ${apiPath}`;

                        const wrappedOutput = {
                            texto: stringifiedEndpoint,
                            paginaId: crypto.randomUUID(),
                            title: endpointTitle,
                            url: apiPath
                        };

                        fs.writeFileSync(filePath, JSON.stringify(wrappedOutput, null, 2), 'utf8');
                        endpointCount++;
                    }
                }
            }
            console.log(`✅ Extracted and formatted ${endpointCount} endpoints.`);
        }

    } catch (err) {
        console.error('❌ Error processing the OpenAPI file:', err.message);
    }
}

// Run the script
processOpenApi();