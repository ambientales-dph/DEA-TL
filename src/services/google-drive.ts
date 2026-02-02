
'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Servicio para gestionar la subida de archivos a Google Drive usando OAuth2.
 * Esto permite usar la cuota de almacenamiento de la cuenta personal (15GB+).
 * 
 * INSTRUCCIONES PARA SOLUCIONAR "unauthorized_client":
 * 
 * 1. CONSOLA DE GOOGLE CLOUD:
 *    - Ve a "Credenciales".
 *    - Edita tu ID de cliente de OAuth 2.0 (DEBE SER TIPO "APLICACIÓN WEB").
 *    - En "URIs de redireccionamiento autorizados", añade: 
 *      https://developers.google.com/oauthplayground
 *    - Guarda los cambios.
 * 
 * 2. OAUTH PLAYGROUND (https://developers.google.com/oauthplayground):
 *    - Haz clic en el icono del engranaje (Settings) a la derecha.
 *    - Marca "Use your own OAuth credentials".
 *    - Pega tu CLIENT ID y CLIENT SECRET.
 *    - En el Paso 1 (izq), busca "Drive API v3" y selecciona: https://www.googleapis.com/auth/drive
 *    - Haz clic en "Authorize APIs" e inicia sesión con ambientales.dph@gmail.com.
 *    - En el Paso 2, haz clic en "Exchange authorization code for tokens".
 *    - COPIA EL REFRESH TOKEN resultante al archivo .env.
 * 
 * 3. PERMANENCIA:
 *    - En "Pantalla de consentimiento de OAuth" de Google Cloud, pon la app en estado "PRODUCCIÓN".
 */

async function getDriveClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Faltan variables de entorno: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET o GOOGLE_REFRESH_TOKEN.');
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        'https://developers.google.com/oauthplayground'
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
        // Log detallado en el servidor para depuración técnica
        console.error('ERROR CRÍTICO EN DRIVE:', {
            message: error.message,
            response: error.response?.data,
            code: error.code
        });

        let userFriendlyMessage = error.message || 'Error desconocido';
        
        if (error.message.includes('unauthorized_client')) {
            userFriendlyMessage = 'Credenciales OAuth2 inválidas (unauthorized_client). Verifica que el Client ID y Secret en .env coincidan con el Refresh Token generado en el Playground.';
        } else if (error.message.includes('invalid_grant')) {
            userFriendlyMessage = 'El Refresh Token ha caducado o ha sido revocado. Genera uno nuevo en el OAuth Playground.';
        }

        throw new Error(`Error al subir a Google Drive: ${userFriendlyMessage}`);
    }
}
