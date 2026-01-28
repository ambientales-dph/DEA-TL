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
    
    if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
        throw new Error('La GOOGLE_PRIVATE_KEY en tu .env parece tener un formato incorrecto. Debe ser una clave multilínea dentro de comillas dobles.');
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
    let drive;
    try {
        drive = getDriveClient();
    } catch (authError: any) {
        // Catch auth errors from getDriveClient and re-throw them with a user-friendly message.
        throw new Error(`Fallo al autenticar con Google Drive. Razón: ${authError.message}`);
    }

    try {
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
        console.error('Error uploading file to Google Drive:', error);

        let reason = 'An unknown error occurred.';
        if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
            reason = error.errors.map((e: any) => e.message).join('; ');
        } else if (error.message) {
            reason = error.message;
        }
        
        if (reason.toLowerCase().includes('file not found')) {
            reason = `El ID de la carpeta raíz especificado en tu archivo .env ('${process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID}') no fue encontrado o la cuenta de servicio no tiene acceso. Por favor, verifica que el ID sea correcto y que la cuenta de servicio tenga permisos de "Editor" sobre esa carpeta.`;
        } 
        else if (reason.includes('invalid_grant')) {
            reason = 'La autenticación falló. Por favor, revisa las credenciales de tu cuenta de servicio (email y clave privada) en el archivo .env.';
        } 
        else if (error.code === 403 || (reason.includes('accessNotConfigured') || reason.includes('disabled in the GCloud project'))) {
            reason = 'La API de Google Drive podría no estar habilitada para este proyecto, o la cuenta de servicio no tiene los permisos necesarios. Por favor, asegúrate de que la API esté habilitada en tu proyecto de Google Cloud y que el email de la cuenta de servicio tenga acceso como "Editor" a la carpeta especificada en GOOGLE_DRIVE_ROOT_FOLDER_ID.';
        }
        
        throw new Error(`Fallo al subir el archivo "${fileName}" a Google Drive. Razón: ${reason}`);
    }
}
