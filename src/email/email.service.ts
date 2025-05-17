import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';

@Injectable()
export class EmailService {
    private readonly oAuth2Client;

    constructor() {
        this.oAuth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            'https://sharing-67g1.onrender.com/auth/callback',
        );

        this.oAuth2Client.setCredentials({
            refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
        });
    }

    async sendVerificationEmail(email: string, token: string): Promise<void> {
        try {
            await this.oAuth2Client.getAccessToken();
            const gmail = google.gmail({
                version: 'v1',
                auth: this.oAuth2Client,
            });

            const message = [
                `From: ${process.env.GOOGLE_EMAIL}`,
                `To: ${email}`,
                'Subject: RideSharing: Verify Your Email',
                '',
                `Your verification code is: ${token}`,
            ].join('\n');

            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            await gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });

            console.log(`Verification email sent to ${email}`);
        } catch (error: any) {
            console.error('Error sending email via Gmail API:', error.message || error);
            throw new Error('Failed to send verification email');
        }
    }
}