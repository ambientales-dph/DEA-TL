'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * IMPORTANT: Google Drive API Configuration
 * 
 * To use these functions, you must:
 * 1. Create a Google Cloud Service Account in your project.
 * 2. Enable the Google Drive API in that Google Cloud project.
 * 3. Create a JSON key for the service account and store its contents in environment variables.
 * 4. The service account will be the owner of the files. To see them, you can share the root
 *    folder of the service account's Drive with your user account, giving it "Viewer" permissions.
 * 
 * Required Environment Variables in your .env file:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: The email of the service account.
 * - GOOGLE_PRIVATE_KEY: The private key from the service account's JSON file.
 *   (Remember to replace all newline characters '\n' with the literal characters '\\n' in the private key).
 */

// Interface for the returned Drive file details
export interface DriveUploadResult {
    id: string;
    webViewLink: string;
}

/**
 * Initializes the Google Drive API client using service account credentials.
 * @returns An authenticated Google Drive API client instance.
 */
function getDriveClient() {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!serviceAccountEmail || !privateKey) {
        throw new Error('Google Drive service account credentials are not configured in environment variables.');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: serviceAccountEmail,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
}


/**
 * Uploads a file to a specified folder in Google Drive.
 * 
 * @param fileName The name of the file to be uploaded.
 * @param mimeType The MIME type of the file.
 * @param base64Data The content of the file as a base64 encoded string.
 * @returns A promise that resolves with the ID and web view link of the uploaded file.
 */
export async function uploadFileToDrive(fileName: string, mimeType: string, base64Data: string): Promise<DriveUploadResult> {
    const drive = getDriveClient();
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // For now, this uploads to the root of the Service Account's Drive.
    // We can enhance this later to create project-specific folders.
    const FOLDER_ID = "root"; 

    const fileMetadata = {
        name: fileName,
        parents: [FOLDER_ID],
    };

    const media = {
        mimeType: mimeType,
        body: Readable.from(fileBuffer),
    };

    try {
        const file = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        if (!file.data.id || !file.data.webViewLink) {
            throw new Error('File uploaded, but failed to get ID or webViewLink.');
        }

        return {
            id: file.data.id,
            webViewLink: file.data.webViewLink,
        };
    } catch (error) {
        console.error('Error uploading file to Google Drive:', error);
        // Re-throw a more user-friendly error
        throw new Error(`Failed to upload file "${fileName}" to Google Drive.`);
    }
}
