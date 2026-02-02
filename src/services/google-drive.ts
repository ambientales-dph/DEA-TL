
'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Servicio para gestionar la subida de archivos a Google Drive utilizando
 * una Cuenta de Servicio de forma directa (compatible con cuentas @gmail.com).
 * 
 * INSTRUCCIONES PARA EL USUARIO:
 * 1. Crea una carpeta en tu Google Drive personal.
 * 2. Comparte esa carpeta con el email de tu cuenta de servicio (Editor).
 * 3. Configura el ID de esa carpeta en GOOGLE_DRIVE_ROOT_FOLDER_ID.
 */

const SCOPES = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive'
];

async function getDriveClient() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!email || !rawKey) {
        throw new Error('Credenciales de Google Drive (email o key) no configuradas en el servidor.');
    }

    const key = rawKey.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').trim();

    const auth = new google.auth.JWT(
        email,
        undefined,
        key,
        SCOPES
    );

    return google.drive({ version: 'v3', auth });
}

async function getOrCreateProjectFolder(drive: any, folderName: string) {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
        throw new Error('ID de carpeta raíz de Google Drive no configurado (GOOGLE_DRIVE_ROOT_FOLDER_ID).');
    }

    try {
        const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`;
        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0].id;
        }

        const fileMetadata = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [rootFolderId],
        };

        const folder = await drive.files.create({
            resource: fileMetadata,
            fields: 'id',
        });

        return folder.data.id;
    } catch (error: any) {
        console.error('Error en getOrCreateProjectFolder:', error.message);
        throw error;
    }
}

export interface DriveUploadResult {
    id: string;
    webViewLink: string;
}

export async function uploadFileToDrive(
    fileName: string, 
    mimeType: string, 
    base64Data: string, 
    projectCode: string | null
): Promise<DriveUploadResult> {
    try {
        const drive = await getDriveClient();
        const folderName = projectCode || 'OTROS_PROYECTOS';
        
        const folderId = await getOrCreateProjectFolder(drive, folderName);

        const buffer = Buffer.from(base64Data, 'base64');
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
        };

        const media = {
            mimeType: mimeType,
            body: bufferStream,
        };

        const file = await drive.files.create({
            requestBody: fileMetadata,
            media: media,
            fields: 'id, webViewLink',
        });

        if (!file.data.id || !file.data.webViewLink) {
            throw new Error('La subida a Drive falló: No se recibió ID o enlace.');
        }

        await drive.permissions.create({
            fileId: file.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        return {
            id: file.data.id,
            webViewLink: file.data.webViewLink,
        };

    } catch (error: any) {
        console.error('Error crítico en uploadFileToDrive:', error.message);
        throw new Error(`Error al subir a Google Drive: ${error.message}`);
    }
}
