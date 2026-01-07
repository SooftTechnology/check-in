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
 * Función para manejar peticiones GET (opcional, para testing)
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, message: 'Google Apps Script is running' }))
    .setMimeType(ContentService.MimeType.JSON);
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

