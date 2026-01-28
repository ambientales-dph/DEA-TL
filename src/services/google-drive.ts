'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * IMPORTANT: Google Drive API Configuration
 * 
 * To use these functions, you must:
 * 1. Create a root folder in your personal Google Drive (e.g., "DEA_TL_archivos").
 * 2. Share this folder with the service account's email, giving it "Editor" permissions.
 * 3. Get the folder's ID from the URL and add it to your .env file as GOOGLE_DRIVE_ROOT_FOLDER_ID.
 * 
 * Required Environment Variables in your .env file:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: The email of the service account.
 * - GOOGLE_PRIVATE_KEY: The private key from the service account's JSON file.
 * - GOOGLE_DRIVE_ROOT_FOLDER_ID: The ID of the shared root folder in your Drive.
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
    // The private key must be a multi-line string in quotes in the .env file.
    const privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

    if (!serviceAccountEmail || !privateKey) {
        throw new Error('Las credenciales de la cuenta de servicio de Google no están configuradas. Revisa GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY en tu archivo .env.');
    }
    
    // Check for the new multi-line format
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('La GOOGLE_PRIVATE_KEY en tu .env parece tener un formato incorrecto. Debe ser una clave multilínea dentro de comillas dobles, comenzando con "-----BEGIN PRIVATE KEY-----".');
    }

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: serviceAccountEmail,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        return google.drive({ version: 'v3', auth });
    } catch (error: any) {
         let reason = 'Ocurrió un error inesperado al crear el cliente de Google Auth.';
         if (error.message) {
            reason = `La autenticación falló al procesar la clave privada. Revisa que GOOGLE_PRIVATE_KEY en tu .env sea correcta. Error original: ${error.message}`;
         }
         throw new Error(reason);
    }
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
        supportsAllDrives: true,
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
            supportsAllDrives: true,
        });
        const newFolderId = folder.data.id!;
        
        // WORKAROUND: Explicitly grant writer permission to the service account for the newly created folder.
        // This can resolve rare permission propagation issues where the service account can create a folder
        // but can't immediately write to it.
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        if (serviceAccountEmail && newFolderId) {
            try {
                await drive.permissions.create({
                    fileId: newFolderId,
                    requestBody: {
                        type: 'user',
                        role: 'writer',
                        emailAddress: serviceAccountEmail,
                    },
                    supportsAllDrives: true,
                });
            } catch (permError) {
                // Log this error but don't block the upload. In most cases, this isn't needed.
                console.warn(`Could not explicitly set permissions on new folder ${newFolderId}, proceeding anyway. Error:`, permError);
            }
        }
        
        return newFolderId;
    }
}


/**
 * Uploads a file to a specified folder in Google Drive using a "create-then-move" strategy
 * to bypass permission race conditions.
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
        const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

        if (!rootFolderId) {
            throw new Error('El ID de la carpeta raíz de Google Drive (GOOGLE_DRIVE_ROOT_FOLDER_ID) no está configurado en el archivo .env.');
        }
        
        let parentFolderId = rootFolderId;

        if (projectCode) {
            parentFolderId = await findOrCreateFolder(drive, projectCode, rootFolderId);
        }

        // Step 1: Create the file without a parent. This creates it in the service account's own space.
        const fileMetadata = {
            name: fileName,
        };
        const media = {
            mimeType: mimeType,
            body: Readable.from(fileBuffer),
        };
        const file = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id',
            supportsAllDrives: true,
        });
        
        const fileId = file.data.id;
        if (!fileId) {
            throw new Error('Fallo al crear el archivo inicial; no se obtuvo un ID de Drive.');
        }

        // Step 2: Move the file to the correct destination folder and retrieve its web link.
        const updatedFile = await drive.files.update({
            fileId: fileId,
            addParents: parentFolderId,
            removeParents: 'root', // Remove from the service account's "My Drive"
            fields: 'id, webViewLink',
            supportsAllDrives: true,
        });

        if (!updatedFile.data.id || !updatedFile.data.webViewLink) {
            throw new Error('Archivo movido, pero falló al obtener el ID final o el enlace de visualización.');
        }

        return {
            id: updatedFile.data.id,
            webViewLink: updatedFile.data.webViewLink,
        };
    } catch (error: any) {
        console.error('Fatal Google Drive Error:', JSON.stringify(error, null, 2));

        // Let's create the most detailed error message possible.
        const fileNameInfo = `para el archivo "${fileName}"`;
        let detailedReason = 'No se pudo determinar la causa exacta.';

        if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
            // This is the most common structure for Google API errors
            detailedReason = error.errors.map((e: any) => `Dominio: ${e.domain}, Razón: ${e.reason}, Mensaje: ${e.message}`).join('; ');
        } else if (error.message) {
            detailedReason = error.message;
        }

        const fullErrorMessage = `Fallo al subir ${fileNameInfo}. Razón detallada de la API de Google: ${detailedReason}. Por favor, revisa el log de la consola para ver el objeto de error completo.`;
        
        throw new Error(fullErrorMessage);
    }
}
