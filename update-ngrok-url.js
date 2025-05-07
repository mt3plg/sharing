const fs = require('fs/promises');
require('dotenv').config();

(async () => {
    try {
        console.log('Waiting for ngrok to generate URL...');
        await new Promise(resolve => setTimeout(resolve, 15000));

        const logContent = await fs.readFile('ngrok.log', 'utf8');
        console.log('ngrok.log content:', logContent);
        const urlMatch = logContent.match(/https:\/\/[a-z0-9-]+\.ngrok-free\.app/);
        if (!urlMatch) {
            throw new Error('Ngrok URL not found in ngrok.log');
        }
        const url = urlMatch[0];
        console.log(`Ngrok URL found: ${url}`);

        let envContent = '';
        try {
            envContent = await fs.readFile('.env', 'utf8');
        } catch (error) {
            console.log('.env file not found, creating new one');
        }

        const envLines = envContent.split('\n').filter(line => !line.startsWith('NGROK_URL='));
        envLines.push(`NGROK_URL=${url}`);
        await fs.writeFile('.env', envLines.join('\n'));
        console.log('.env file updated with NGROK_URL:', url);

        process.env.NGROK_URL = url;
    } catch (error) {
        console.error('Failed to update ngrok URL:', error.message);
        console.error('Error details:', error);
        process.exit(1);
    }
})();