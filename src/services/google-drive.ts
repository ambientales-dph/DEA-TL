'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * =======================================================================================
 * IMPORTANTE: LIMITACIÓN DE CUOTA DE ALMACENAMIENTO DE CUENTAS DE SERVICIO
 *
 * Las funciones en este archivo están INOPERATIVAS debido a una limitación fundamental
 * de las Cuentas de Servicio de Google. Según la política de Google, las cuentas de servicio
 * no tienen su propia cuota de almacenamiento en Google Drive. Por lo tanto, cualquier intento
 * de subir un archivo que haga a la cuenta de servicio la propietaria fallará con un
 * error `storageQuotaExceeded`.
 *
 * La solución correcta a largo plazo es implementar un flujo de OAuth 2.0 donde el usuario
 * final otorga permiso a la aplicación. La aplicación actuaría entonces en nombre del
 * usuario, y los archivos subidos serían propiedad del usuario, consumiendo su cuota de
 * almacenamiento.
 *
 * Hasta que se implemente dicho flujo, estas funciones no deben ser utilizadas. La función
 * `uploadFileToDrive` ha sido modificada para lanzar un error explícito y prevenir su uso.
 *
 * SOLUCIÓN ALTERNATIVA PARA USUARIOS: Añadir archivos como adjuntos directamente a las
 * tarjetas de Trello. La funcionalidad de sincronización de Trello de la aplicación
 * los asociará correctamente con los hitos.
 * =======================================================================================
 */

// Interface for the returned Drive file details
export interface DriveUploadResult {
    id: string;
    webViewLink: string;
}

/**
 * Uploads a file to a specified folder in Google Drive.
 * ESTA FUNCIÓN ESTÁ DESACTIVADA INTENCIONALMENTE.
 */
export async function uploadFileToDrive(fileName: string, mimeType: string, base64Data: string, projectCode: string | null): Promise<DriveUploadResult> {
    const errorMessage = `La subida manual de archivos a Google Drive no es posible. Las Cuentas de Servicio no tienen cuota de almacenamiento. La solución recomendada es adjuntar los archivos a las tarjetas de Trello, que se sincronizarán automáticamente.`;
    
    // Lanzamos un error que será capturado por los componentes de la UI y mostrado al usuario.
    throw new Error(errorMessage);
}
