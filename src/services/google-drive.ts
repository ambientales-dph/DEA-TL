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
    const drive = getDriveClient();
    const fileBuffer = Buffer.from(base64Data, 'base64');
    
    const ROOT_FOLDER_NAME = "DEA_TL_archivos";

    try {
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
    } catch (error) {
        console.error('Error uploading file to Google Drive:', error);
        throw new Error(`Failed to upload file "${fileName}" to Google Drive.`);
    }
}
