const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');

const credentials = require('./credentials.json');
const { client_secret, client_id, redirect_uris } = credentials.web;
const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];
const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
});
console.log('Authorize this app by visiting this url:', authUrl);

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});

readline.question('Enter the code from that page here: ', async (code) => {
    readline.close();
    try {
        console.log('Attempting to exchange code:', code);
        const { tokens } = await oAuth2Client.getToken(code);
        console.log('Tokens received:', tokens);
        console.log('Refresh Token:', tokens.refresh_token);
        fs.writeFileSync('tokens.json', JSON.stringify(tokens));
    } catch (error) {
        console.error('Error retrieving access token:', error.message, error.response?.data);
    }
});