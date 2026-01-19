const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const glob = require('glob');

// Define the order of files as they appear in index.html
const fileOrder = [
    'frontend/src/js/router.js',
    'frontend/src/js/utils/ai-chat-utils.js',
    'frontend/src/js/components/timeline.js',
    'frontend/src/js/components/comment.js',
    'frontend/src/js/components/search.js',
    'frontend/src/js/components/auth.js',
    'frontend/src/js/components/map.js',
    'frontend/src/js/components/waittime.js',
    'frontend/src/js/components/checkin.js',
    'frontend/src/js/components/stamp-rally.js',
    'frontend/src/js/components/rankings.js',
    'frontend/src/js/components/guide.js',
    'frontend/src/js/components/ai-support.js',
    'frontend/src/js/components/settings.js',
    'frontend/src/js/components/profile.js',
    'frontend/src/js/components/shop-detail.js',
    'frontend/src/js/components/external-link.js',
    'frontend/src/js/components/global-search.js',
    'frontend/src/js/components/right-sidebar.js',
    'frontend/src/js/app.js'
];

// Check if files exist
const missingFiles = fileOrder.filter(file => !fs.existsSync(file));
if (missingFiles.length > 0) {
    console.error('Missing files:', missingFiles);
    process.exit(1);
}

// Concatenate files
let concatenatedCode = '';
fileOrder.forEach(file => {
    concatenatedCode += fs.readFileSync(file, 'utf8') + '\n\n';
});

// Obfuscate
const obfuscationResult = JavaScriptObfuscator.obfuscate(concatenatedCode, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 1,
    deadCodeInjection: true,
    deadCodeInjectionThreshold: 1,
    debugProtection: true,
    debugProtectionInterval: 4000,
    disableConsoleOutput: true,
    identifierNamesGenerator: 'hexadecimal',
    log: false,
    numbersToExpressions: true,
    renameGlobals: false, // Keep global names intact to avoid breaking HTML inline calls
    selfDefending: true,
    simplify: true,
    splitStrings: true,
    splitStringsChunkLength: 5,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ['rc4'],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 5,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 5,
    stringArrayThreshold: 1,
    transformObjectKeys: true,
    unicodeEscapeSequence: false
});

// Write output
const outputDir = 'frontend/dist';
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(path.join(outputDir, 'bundle.js'), obfuscationResult.getObfuscatedCode());

console.log('Obfuscation complete: frontend/dist/bundle.js');
