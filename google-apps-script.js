/**
 * Google Apps Script para recibir datos del Check-in y guardarlos en Google Sheets
 * 
 * INSTRUCCIONES:
 * 1. Abre tu Google Sheet: https://docs.google.com/spreadsheets/d/1Kxu7-T_ArqZ5dqV3Xw8D8Bo4tZsmTtBZggDWey-hUsA/edit
 * 2. Ve a Extensiones > Apps Script
 * 3. Pega este código completo
 * 4. Guarda el proyecto (Ctrl+S o Cmd+S)
 * 5. Haz clic en "Desplegar" > "Nueva implementación"
 * 6. Selecciona tipo "Aplicación web"
 * 7. Configura:
 *    - Ejecutar como: Yo (tu cuenta)
 *    - Quién tiene acceso: Cualquiera
 * 8. Haz clic en "Desplegar"
 * 9. Copia la URL de la aplicación web
 * 10. Agrega esa URL como variable de entorno VITE_GOOGLE_SCRIPT_URL
 */

// ID de tu Google Sheet (extraído de la URL)
const SHEET_ID = '1Kxu7-T_ArqZ5dqV3Xw8D8Bo4tZsmTtBZggDWey-hUsA';
const SHEET_NAME = 'Hoja 1'; // Cambia esto si tu hoja tiene otro nombre

/**
 * Función principal que se ejecuta cuando se recibe una petición POST
 */
function doPost(e) {
  try {
    // Parsear los datos recibidos
    const data = JSON.parse(e.postData.contents);
    
    if (data.action === 'append') {
      return appendToSheet(data.data);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: 'Invalid action' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Función para manejar peticiones GET
 * Soporta dos acciones:
 * - check: Verifica si existe una respuesta para un email y monthId
 * - Sin parámetros: Devuelve estado del script
 */
function doGet(e) {
  try {
    // Los parámetros vienen en e.parameter cuando se usa URL con query string
    // En Google Apps Script, e.parameter es un objeto donde las claves son los nombres de los parámetros
    const action = e.parameter ? (e.parameter.action || e.parameter['action']) : null;
    const email = e.parameter ? (e.parameter.email || e.parameter['email']) : null;
    const monthId = e.parameter ? (e.parameter.monthId || e.parameter['monthId']) : null;
    
    // Log para debugging (solo visible en el editor de Apps Script)
    Logger.log('doGet called');
    Logger.log('e.parameter: ' + JSON.stringify(e.parameter));
    Logger.log('action: ' + action + ', email: ' + email + ', monthId: ' + monthId);
    
    // Si tiene los parámetros correctos, verificar
    if (action === 'check' && email && monthId) {
      Logger.log('Calling checkIfExists with: ' + email + ', ' + monthId);
      return checkIfExists(email, monthId);
    }
    
    // Si no tiene los parámetros correctos, devolver mensaje de estado con información de debug
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'Google Apps Script is running',
        receivedParams: e.parameter || {},
        action: action,
        email: email,
        monthId: monthId,
        note: 'Use ?action=check&email=xxx&monthId=YYYY-MM to check if response exists'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString(),
        stack: error.stack
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Verifica si existe una respuesta para un email y monthId específicos
 */
function checkIfExists(email, monthId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ 
          success: true, 
          exists: false,
          reason: 'Sheet is empty or has no data'
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Obtener todos los datos (empezando desde la fila 2, ya que la 1 es el header)
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 8);
    const values = dataRange.getValues();
    
    // Buscar si existe una fila con el email y monthId
    // Columnas: Email (0), Completitud (1), Bugs (2), Satisfacción (3), Comentarios (4), Timestamp (5), Month ID (6), Month Name (7)
    const searchEmail = String(email).trim().toLowerCase();
    const searchMonthId = String(monthId).trim();
    
    let exists = false;
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowEmail = String(row[0] || '').trim().toLowerCase();
      const rowMonthId = String(row[6] || '').trim();
      
      if (rowEmail === searchEmail && rowMonthId === searchMonthId) {
        exists = true;
        break;
      }
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        exists: exists,
        searched: { email: searchEmail, monthId: searchMonthId },
        totalRows: values.length
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString(),
        stack: error.stack
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Agrega una fila nueva a la hoja de cálculo
 */
function appendToSheet(data) {
  try {
    // Abrir la hoja de cálculo
    const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    
    // Si la hoja no existe, crearla
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAME);
    }
    
    // Verificar si el header existe (si la primera fila está vacía o no tiene el header esperado)
    const firstRow = sheet.getRange(1, 1, 1, 8).getValues()[0];
    const hasHeader = firstRow[0] === 'Email' || firstRow[0] === '';
    
    // Si no hay header, agregarlo
    if (!hasHeader || sheet.getLastRow() === 0) {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, 8).setValues([[
        'Email',
        'Completitud (%)',
        'Bugs',
        'Satisfacción',
        'Comentarios',
        'Timestamp',
        'Month ID',
        'Month Name'
      ]]);
      // Formatear encabezados
      const headerRange = sheet.getRange(1, 1, 1, 8);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4F46E5');
      headerRange.setFontColor('#FFFFFF');
    }
    
    // Agregar la nueva fila con los datos
    sheet.appendRow([
      data.email || '',
      data.completion || 0,
      data.bugs || 0,
      data.satisfaction || 0,
      data.comments || '',
      data.timestamp || new Date().toLocaleString(),
      data.monthId || '',
      data.monthName || ''
    ]);
    
    // Aplicar formato a la nueva fila (opcional)
    const lastRow = sheet.getLastRow();
    const newRowRange = sheet.getRange(lastRow, 1, 1, 8);
    newRowRange.setBorder(true, true, true, true, true, true);
    
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: true, 
        message: 'Data appended successfully',
        row: lastRow 
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        error: error.toString() 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

