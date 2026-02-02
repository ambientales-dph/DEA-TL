
'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Servicio para gestionar la subida de archivos a Google Drive utilizando
 * Cuentas de Servicio con Delegación de Dominio (Impersonation).
 */

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'];

// La cuenta que personificaremos para evitar límites de cuota de la cuenta de servicio
const IMPERSONATED_USER = 'ambientales.dph@gmail.com';

async function getDriveClient() {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!email || !key) {
        throw new Error('Credenciales de Google Drive no configuradas en el servidor.');
    }

    const auth = new google.auth.JWT(
        email,
        undefined,
        key,
        SCOPES,
        IMPERSONATED_USER
    );

    return google.drive({ version: 'v3', auth });
}

/**
 * Busca una carpeta por nombre dentro de una carpeta padre. 
 * Si no existe, la crea.
 */
async function getOrCreateProjectFolder(drive: any, folderName: string) {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
        throw new Error('ID de carpeta raíz de Google Drive no configurado (GOOGLE_DRIVE_ROOT_FOLDER_ID).');
    }

    // Buscar carpeta existente
    const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and '${rootFolderId}' in parents and trashed = false`;
    const response = await drive.files.list({
        q: query,
        fields: 'files(id, name)',
        spaces: 'drive',
    });

    if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
    }

    // Crear carpeta si no existe
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
}

export interface DriveUploadResult {
    id: string;
    webViewLink: string;
}

/**
 * Sube un archivo a Google Drive dentro de la carpeta del proyecto.
 */
export async function uploadFileToDrive(
    fileName: string, 
    mimeType: string, 
    base64Data: string, 
    projectCode: string | null
): Promise<DriveUploadResult> {
    try {
        const drive = await getDriveClient();
        const folderName = projectCode || 'OTROS_PROYECTOS';
        
        // 1. Obtener o crear la carpeta del proyecto
        const folderId = await getOrCreateProjectFolder(drive, folderName);

        // 2. Preparar el contenido del archivo
        const buffer = Buffer.from(base64Data, 'base64');
        const bufferStream = new Readable();
        bufferStream.push(buffer);
        bufferStream.push(null);

        // 3. Subir el archivo
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

        // 4. Hacer que el archivo sea accesible mediante el enlace (opcional, dependiendo de permisos del dominio)
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
        console.error('Error en uploadFileToDrive:', error);
        throw new Error(`Error al subir a Google Drive: ${error.message}`);
    }
}
