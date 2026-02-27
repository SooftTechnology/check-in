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
 * Función auxiliar para crear respuesta con headers CORS
 * Google Apps Script automáticamente agrega CORS cuando se despliega como "Aplicación web" con acceso "Cualquiera"
 */
function createResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Maneja las peticiones OPTIONS (preflight de CORS)
 */
function doOptions() {
  return createResponse({ success: true, message: 'CORS preflight' });
}

/**
 * Función principal que se ejecuta cuando se recibe una petición POST
 */
function doPost(e) {
  try {
    // Log para debugging (solo visible en el editor de Apps Script)
    Logger.log('doPost called');
    Logger.log('e.postData.type: ' + (e.postData ? e.postData.type : 'no postData'));
    Logger.log('e.postData.contents: ' + (e.postData ? e.postData.contents : 'no contents'));
    
    // Verificar que hay datos POST
    if (!e.postData || !e.postData.contents) {
      Logger.log('No postData.contents found');
      return createResponse({ 
        success: false, 
        error: 'No data received',
        received: e 
      });
    }
    
    // Parsear los datos recibidos
    let data;
    try {
      data = JSON.parse(e.postData.contents);
      Logger.log('Parsed data: ' + JSON.stringify(data));
    } catch (parseError) {
      Logger.log('Error parsing JSON: ' + parseError.toString());
      return createResponse({ 
        success: false, 
        error: 'Invalid JSON: ' + parseError.toString(),
        received: e.postData.contents 
      });
    }
    
    // Manejar acción 'append'
    if (data.action === 'append' && data.data) {
      Logger.log('Calling appendToSheet');
      return appendToSheet(data.data);
    }
    
    // Manejar acción 'check'
    if (data.action === 'check') {
      if (!data.email || !data.monthId) {
        Logger.log('Missing email or monthId for check action');
        return createResponse({ 
          success: false, 
          error: 'Missing email or monthId',
          received: data 
        });
      }
      Logger.log('Calling checkIfExists with: ' + data.email + ', ' + data.monthId);
      return checkIfExists(data.email, data.monthId);
    }
    
    Logger.log('Invalid action: ' + (data.action || 'no action'));
    return createResponse({ 
      success: false, 
      error: 'Invalid action or missing parameters',
      received: data 
    });
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    Logger.log('Stack: ' + (error.stack || 'no stack'));
    return createResponse({ 
      success: false, 
      error: error.toString(),
      stack: error.stack 
    });
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
    return createResponse({ 
      success: true, 
      message: 'Google Apps Script is running',
      receivedParams: e.parameter || {},
      action: action,
      email: email,
      monthId: monthId,
      note: 'Use POST with action=check&email=xxx&monthId=YYYY-MM to check if response exists'
    });
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return createResponse({ 
      success: false, 
      error: error.toString(),
      stack: error.stack
    });
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
      Logger.log('Sheet is empty or has no data');
      return createResponse({ 
        success: true, 
        exists: false,
        reason: 'Sheet is empty or has no data'
      });
    }
    
    // Obtener todos los datos (empezando desde la fila 2, ya que la 1 es el header)
    const lastRow = sheet.getLastRow();
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 9);
    const values = dataRange.getValues();
    
    // Obtener el header para verificar el orden de las columnas
    const headerRow = sheet.getRange(1, 1, 1, 9).getValues()[0];
    Logger.log('Headers encontrados: ' + JSON.stringify(headerRow));
    
    // Buscar si existe una fila con el email y monthId
    // Columnas esperadas: Email (0), Completitud (1), Bugs (2), Satisfacción (3), Autoevaluación (4), Comentarios (5), Timestamp (6), Month ID (7), Month Name (8)
    const searchEmail = String(email).trim().toLowerCase();
    const searchMonthId = String(monthId).trim();
    
    Logger.log('Buscando: email=' + searchEmail + ', monthId=' + searchMonthId);
    Logger.log('Total filas a revisar: ' + values.length);
    
    // Mostrar TODAS las columnas de las primeras 3 filas para debug
    for (let i = 0; i < Math.min(3, values.length); i++) {
      const row = values[i];
      Logger.log('Fila ' + (i + 2) + ' completa:');
      for (let col = 0; col < row.length; col++) {
        Logger.log('  Col[' + col + '] (' + (headerRow[col] || 'sin header') + '): "' + row[col] + '" (tipo: ' + typeof row[col] + ')');
      }
    }
    
    let exists = false;
    const foundRows = [];
    
    // Función auxiliar para normalizar monthId (maneja fechas y strings)
    function normalizeMonthId(value) {
      if (!value) return '';
      
      // Si es una fecha (objeto Date)
      if (value instanceof Date) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        return year + '-' + month;
      }
      
      // Si es string, intentar parsear como fecha primero
      const str = String(value).trim();
      
      // Si parece una fecha completa (ej: "Thu Jan 01 2026...")
      if (str.includes('GMT') || str.includes('Jan') || str.includes('Feb') || str.includes('Mar') || 
          str.includes('Apr') || str.includes('May') || str.includes('Jun') ||
          str.includes('Jul') || str.includes('Aug') || str.includes('Sep') ||
          str.includes('Oct') || str.includes('Nov') || str.includes('Dec')) {
        try {
          const date = new Date(str);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            return year + '-' + month;
          }
        } catch (e) {
          // Si falla el parseo, continuar con el string original
        }
      }
      
      // Si ya está en formato YYYY-MM, devolverlo tal cual
      if (/^\d{4}-\d{2}$/.test(str)) {
        return str;
      }
      
      // Si es un número (timestamp), convertirlo
      const num = Number(str);
      if (!isNaN(num) && num > 0) {
        const date = new Date(num);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          return year + '-' + month;
        }
      }
      
      return str;
    }
    
    // Buscar todas las filas que coincidan con el email para debug
    const matchingEmails = [];
    
    // Buscar dinámicamente qué columna tiene "Month ID" en el header
    let monthIdColumnIndex = 7; // Por defecto columna 7 (índice 7, por la nueva columna Autoevaluación)
    let emailColumnIndex = 0; // Por defecto columna 0 (índice 0)
    
    for (let i = 0; i < headerRow.length; i++) {
      const header = String(headerRow[i] || '').toLowerCase();
      if (header.includes('month id') || header.includes('monthid') || header === 'month id') {
        monthIdColumnIndex = i;
        Logger.log('Month ID encontrado en columna ' + i);
      }
      if (header.includes('email') || header === 'email') {
        emailColumnIndex = i;
        Logger.log('Email encontrado en columna ' + i);
      }
    }
    
    Logger.log('Usando columnas: Email=' + emailColumnIndex + ', Month ID=' + monthIdColumnIndex);
    
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      // Convertir a string y limpiar - manejar diferentes tipos de datos
      const rowEmail = String(row[emailColumnIndex] || '').trim().toLowerCase();
      const rowMonthIdRaw = row[monthIdColumnIndex]; // Usar la columna encontrada dinámicamente
      const rowMonthId = normalizeMonthId(rowMonthIdRaw);
      
      // Log de las primeras 3 filas para debug
      if (i < 3) {
        Logger.log('Fila ' + (i + 2) + ': email="' + rowEmail + '", monthId original="' + rowMonthIdRaw + '", monthId normalizado="' + rowMonthId + '"');
        Logger.log('  Tipo email: ' + typeof row[0] + ', Tipo monthId: ' + typeof row[6]);
      }
      
      // Comparación más flexible
      const emailMatch = rowEmail === searchEmail;
      const monthIdMatch = rowMonthId === searchMonthId;
      
      // Guardar todas las filas que coinciden con el email para debug
      if (emailMatch) {
        matchingEmails.push({
          row: i + 2,
          email: rowEmail,
          monthId: rowMonthId,
          monthIdOriginal: String(rowMonthIdRaw),
          monthIdType: typeof rowMonthIdRaw
        });
      }
      
      if (emailMatch && monthIdMatch) {
        exists = true;
        foundRows.push({ row: i + 2, email: rowEmail, monthId: rowMonthId, monthIdOriginal: String(rowMonthIdRaw) });
        Logger.log('✅ MATCH encontrado en fila ' + (i + 2));
        break;
      } else if (emailMatch) {
        // Email coincide pero monthId no - útil para debug
        Logger.log('⚠️ Email coincide pero monthId no: buscado="' + searchMonthId + '", encontrado="' + rowMonthId + '" (original: "' + rowMonthIdRaw + '", tipo: ' + typeof rowMonthIdRaw + ') en fila ' + (i + 2));
      } else if (monthIdMatch) {
        // MonthId coincide pero email no - útil para debug
        Logger.log('⚠️ MonthId coincide pero email no: buscado="' + searchEmail + '", encontrado="' + rowEmail + '" en fila ' + (i + 2));
      }
    }
    
    // Si no se encontró match pero hay emails que coinciden, loggear todas
    if (!exists && matchingEmails.length > 0) {
      Logger.log('⚠️ Se encontraron ' + matchingEmails.length + ' filas con el email "' + searchEmail + '" pero ninguna con monthId "' + searchMonthId + '":');
      matchingEmails.forEach(m => {
        Logger.log('  Fila ' + m.row + ': monthId="' + m.monthId + '" (original: "' + m.monthIdOriginal + '", tipo: ' + m.monthIdType + ')');
      });
    }
    
    Logger.log('checkIfExists result: exists=' + exists + ', searched=' + searchEmail + '/' + searchMonthId + ', totalRows=' + values.length);
    
    // Devolver información de debug útil
    return createResponse({ 
      success: true, 
      exists: exists,
      searched: { email: searchEmail, monthId: searchMonthId },
      totalRows: values.length,
      foundRows: foundRows,
      matchingEmails: matchingEmails, // Todas las filas con el email buscado
      debug: {
        searchEmail: searchEmail,
        searchMonthId: searchMonthId,
        headers: headerRow,
        emailColumnIndex: emailColumnIndex,
        monthIdColumnIndex: monthIdColumnIndex,
        firstFewRows: values.slice(0, 3).map((row, idx) => ({
          row: idx + 2,
          email: String(row[emailColumnIndex] || '').trim(),
          monthId: normalizeMonthId(row[monthIdColumnIndex]),
          monthIdOriginal: String(row[monthIdColumnIndex] || ''),
          monthIdType: typeof row[monthIdColumnIndex],
          allColumns: row.map((val, colIdx) => ({
            col: colIdx,
            header: headerRow[colIdx] || '',
            value: String(val || ''),
            type: typeof val
          }))
        }))
      }
    });
      
  } catch (error) {
    Logger.log('Error in checkIfExists: ' + error.toString());
    return createResponse({ 
      success: false, 
      error: error.toString(),
      stack: error.stack
    });
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
    const firstRow = sheet.getRange(1, 1, 1, 9).getValues()[0];
    const hasHeader = firstRow[0] === 'Email' || firstRow[0] === '';
    
    // Si no hay header, agregarlo
    if (!hasHeader || sheet.getLastRow() === 0) {
      sheet.insertRowBefore(1);
      sheet.getRange(1, 1, 1, 9).setValues([[
        'Email',
        'Completitud (%)',
        'Bugs',
        'Satisfacción',
        'Autoevaluación',
        'Comentarios',
        'Timestamp',
        'Month ID',
        'Month Name'
      ]]);
      // Formatear encabezados
      const headerRange = sheet.getRange(1, 1, 1, 9);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#4F46E5');
      headerRange.setFontColor('#FFFFFF');
    }
    
    // Agregar la nueva fila con los datos
    const lastRow = sheet.getLastRow() + 1;
    sheet.getRange(lastRow, 1, 1, 9).setValues([[
      data.email || '',
      data.completion || 0,
      data.bugs || 0,
      data.satisfaction || 0,
      data.selfEvaluation || '',
      data.comments || '',
      data.timestamp || new Date().toLocaleString(),
      data.monthId || '', // Guardar como texto
      data.monthName || ''
    ]]);
    
    // Asegurar que la columna Month ID (columna 8, índice 7) sea texto
    // Usar formato de texto para evitar que Google Sheets convierta "2026-01" a fecha
    sheet.getRange(lastRow, 8, 1, 1).setNumberFormat('@');
    
    // Aplicar formato a la nueva fila (opcional)
    const newRowRange = sheet.getRange(lastRow, 1, 1, 9);
    newRowRange.setBorder(true, true, true, true, true, true);
    
    Logger.log('appendToSheet success: row ' + lastRow);
    return createResponse({ 
      success: true, 
      message: 'Data appended successfully',
      row: lastRow 
    });
      
  } catch (error) {
    Logger.log('Error in appendToSheet: ' + error.toString());
    return createResponse({ 
      success: false, 
      error: error.toString() 
    });
  }
}

