
'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Servicio para gestionar la subida de archivos a Google Drive usando OAuth2.
 * 
 * SI EL ERROR "unauthorized_client" PERSISTE:
 * 1. Asegúrate de que en Google Cloud Console el tipo de credencial sea "APLICACIÓN WEB".
 * 2. En el OAuth Playground, DEBES marcar la casilla "Use your own OAuth credentials" 
 *    en el icono del engranaje (derecha) ANTES de autorizar.
 * 3. Si nada funciona, borra las credenciales en la consola de Google y créalas de nuevo.
 */

async function getDriveClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Faltan variables de entorno: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REFRESH_TOKEN.');
    }

    // Inicializamos sin redirectUri para el refresco de token, es más estable.
    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret
    );

    oauth2Client.setCredentials({
        refresh_token: refreshToken
    });

    return google.drive({ version: 'v3', auth: oauth2Client });
}

async function getOrCreateProjectFolder(drive: any, folderName: string) {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
        throw new Error('ID de carpeta raíz no configurado (GOOGLE_DRIVE_ROOT_FOLDER_ID).');
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
        console.error('Error al buscar/crear carpeta en Drive:', error.message);
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

        // Aseguramos acceso de lectura para cualquier persona con el link
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
        // Extraemos la descripción detallada del error de Google si existe
        const errorDetail = error.response?.data?.error_description || error.message;
        
        console.error('ERROR DETALLADO DE GOOGLE DRIVE:', {
            error: error.response?.data?.error,
            description: errorDetail,
            status: error.response?.status
        });

        let userFriendlyMessage = errorDetail;
        
        if (errorDetail.includes('unauthorized_client')) {
            userFriendlyMessage = 'Error de autorización (unauthorized_client). Esto ocurre si el Refresh Token se generó con un Client ID distinto al configurado o si falta marcar "Use your own OAuth credentials" en el Playground.';
        } else if (errorDetail.includes('invalid_grant')) {
            userFriendlyMessage = 'El Refresh Token ha caducado o es inválido. Por favor, genera uno nuevo.';
        }

        throw new Error(`Error al subir a Google Drive: ${userFriendlyMessage}`);
    }
}
