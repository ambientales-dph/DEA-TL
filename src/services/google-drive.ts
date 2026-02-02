
'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * Servicio para gestionar la subida de archivos a Google Drive usando OAuth2.
 * Esto permite usar la cuota de almacenamiento de la cuenta personal (15GB+).
 * 
 * INSTRUCCIONES PARA CONFIGURAR (Solo una vez):
 * 1. Ve a Google Cloud Console -> APIs y servicios -> Credenciales.
 * 2. Crea un "ID de cliente de OAuth 2.0" (Tipo: Aplicación web).
 * 3. Añade "https://developers.google.com/oauthplayground" a los URIs de redireccionamiento autorizados.
 * 4. Usa el OAuth Playground de Google para autorizar Drive API v3 y obtener un REFRESH TOKEN.
 * 
 * PARA QUE EL TOKEN NO CADUQUE (Importante):
 * 1. Ve a "Pantalla de consentimiento de OAuth" en Google Cloud Console.
 * 2. Cambia el "Estado de publicación" de "En pruebas" a "EN PRODUCCIÓN".
 * 3. Si no haces esto, el token expirará cada 7 días.
 * 
 * Configura en tu .env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REFRESH_TOKEN.
 */

async function getDriveClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error('Configuración de OAuth2 de Google Drive incompleta en el servidor (.env).');
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

        // Hacemos que el archivo sea visible para cualquiera con el link (opcional)
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
        console.error('Error crítico en uploadFileToDrive:', error);
        throw new Error(`Error al subir a Google Drive: ${error.message || 'Error desconocido'}`);
    }
}
