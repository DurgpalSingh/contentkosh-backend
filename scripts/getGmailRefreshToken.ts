import 'dotenv/config';
import http from 'http';
import { OAuth2Client } from 'google-auth-library';

const REDIRECT_PORT = 53682;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;
const SCOPES = ['https://www.googleapis.com/auth/gmail.send'];

async function main() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env before running this script.');
    process.exit(1);
  }

  const oauth2Client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\n1. Open this URL in a browser and sign in with the Gmail account that should SEND the emails:\n');
  console.log(authUrl);
  console.log('\n2. Approve access. This script will catch the redirect automatically.\n');
  console.log(`Waiting for redirect on ${REDIRECT_URI} ...`);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '', REDIRECT_URI);
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end();
        return;
      }

      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error || !code) {
        res.writeHead(400, { 'Content-Type': 'text/plain' }).end(`Authorization failed: ${error ?? 'no code returned'}`);
        console.error('Authorization failed:', error ?? 'no code returned');
        server.close(() => process.exit(1));
        return;
      }

      const { tokens } = await oauth2Client.getToken(code);
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('Success! You can close this tab and return to the terminal.');

      if (!tokens.refresh_token) {
        console.error(
          '\nNo refresh_token was returned. This usually means this account already granted consent before.\n' +
            'Go to https://myaccount.google.com/permissions, remove access for this app, and run this script again.'
        );
        server.close(() => process.exit(1));
        return;
      }

      console.log('\nGMAIL_REFRESH_TOKEN=' + tokens.refresh_token);
      console.log('\nCopy the line above into your .env file.\n');
      server.close(() => process.exit(0));
    } catch (err) {
      console.error('Token exchange failed:', err);
      res.writeHead(500).end('Token exchange failed, check the terminal.');
      server.close(() => process.exit(1));
    }
  });

  server.listen(REDIRECT_PORT);
}

main();
