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
    // The replace call is crucial for keys stored in .env files.
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replaceAll('\\n', '\n');

    if (!serviceAccountEmail || !privateKey) {
        throw new Error('Google Drive service account credentials are not configured in environment variables. Please check your .env file for GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.');
    }
    
    // Add a sanity check for the private key format.
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('The GOOGLE_PRIVATE_KEY in your .env file appears to be malformed or is missing. It should start with "-----BEGIN PRIVATE KEY-----". Please ensure it is copied correctly and is on a single line with "\\n" for newlines.');
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
 * Finds a folder by name within a parent folder, or creates it if it doesn't exist.
 * @param drive The authenticated Google Drive client.
 * @param name The name of the folder to find or create.
 * @param parentId The ID of the parent folder.
 * @returns The ID of the found or created folder.
 */
async function findOrCreateFolder(drive: any, name: string, parentId: string): Promise<string> {
    const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and '${parentId}' in parents and trashed=false`;
    
    const response = await drive.files.list({
        q: query,
        fields: 'files(id)',
        spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id!;
    } else {
        const folderMetadata = {
            name: name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId],
        };
        const folder = await drive.files.create({
            requestBody: folderMetadata,
            fields: 'id',
        });
        return folder.data.id!;
    }
}


/**
 * Uploads a file to a specified folder in Google Drive, organizing by project code.
 * 
 * @param fileName The name of the file to be uploaded.
 * @param mimeType The MIME type of the file.
 * @param base64Data The content of the file as a base64 encoded string.
 * @param projectCode The code of the project (e.g., RSB002), used for creating a subfolder.
 * @returns A promise that resolves with the ID and web view link of the uploaded file.
 */
export async function uploadFileToDrive(fileName: string, mimeType: string, base64Data: string, projectCode: string | null): Promise<DriveUploadResult> {
    try {
        const drive = getDriveClient();
        const fileBuffer = Buffer.from(base64Data, 'base64');
        
        const ROOT_FOLDER_NAME = "DEA_TL_archivos";

        // 1. Find or create the root folder.
        const rootFolderId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME, 'root');
        
        let parentFolderId = rootFolderId;

        // 2. If a project code is provided, find or create the project subfolder.
        if (projectCode) {
            parentFolderId = await findOrCreateFolder(drive, projectCode, rootFolderId);
        }

        const fileMetadata = {
            name: fileName,
            parents: [parentFolderId],
        };

        const media = {
            mimeType: mimeType,
            body: Readable.from(fileBuffer),
        };

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
    } catch (error: any) {
        console.error('Error uploading file to Google Drive:', error);

        let reason = 'An unknown error occurred.';
        if (error.message && error.message.includes('DECODER routines')) {
            reason = `Authentication failed while parsing the private key. This almost always means the GOOGLE_PRIVATE_KEY in your .env file is malformed. Please ensure it is on a single line, wrapped in double quotes, and that all newline characters are escaped as \\n. Original error: ${error.message}`;
        } else if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
            reason = error.errors.map((e: any) => e.message).join('; ');
        } else if (error.message) {
            reason = error.message;
        }

        if (reason.includes('invalid_grant')) {
            reason = 'Authentication failed. Please check your service account credentials (email and private key) in the .env file. The private key might be malformed or the service account does not exist.';
        } else if (reason.includes('accessNotConfigured') || reason.includes('disabled in the GCloud project') || (error.code && error.code === 403)) {
            reason = 'The Google Drive API might not be enabled for this project, or the service account lacks permissions. Please check the Google Cloud Console.';
        }
        
        throw new Error(`Failed to upload file "${fileName}" to Google Drive. Reason: ${reason}`);
    }
}
