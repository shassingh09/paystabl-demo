// generate-private-key.mjs
import { generatePrivateKey } from 'viem/accounts';
import fs from 'fs';

const privateKey = generatePrivateKey();

fs.appendFileSync('examples/typescript/dynamic_agent/.env', `\n# Generated wallet\nPRIVATE_KEY=${privateKey}\n`);
console.log('✅ PRIVATE_KEY added to .env');