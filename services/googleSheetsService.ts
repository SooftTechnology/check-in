export interface GoogleSheetsReview {
  email: string;
  completion: number;
  bugs: number;
  satisfaction: number;
  selfEvaluation?: string;
  comments?: string;
  timestamp: string;
  monthId: string;
  monthName: string;
}

// La variable de entorno se inyecta en tiempo de build por Vite
// @ts-ignore - Vite inyecta estas variables en tiempo de build
const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

/**
 * Verifica si ya existe una respuesta para un email y monthId en Google Sheets
 */
/**
 * Verifica si ya existe una respuesta para un email y monthId en Google Sheets
 * Usa POST porque GET no está recibiendo los parámetros correctamente en Google Apps Script
 */
export const checkIfResponseExists = async (email: string, monthId: string): Promise<boolean> => {
  try {
    if (!GOOGLE_SCRIPT_URL) {
      console.warn('⚠️ Google Script URL not configured. Usando solo localStorage.');
      return false;
    }

    console.log('🔍 Verificando en Google Sheets (POST):', { email, monthId });

    const postData = {
      action: 'check',
      email: email,
      monthId: monthId,
    };
    
    // Intentar POST directo usando text/plain para evitar preflight CORS
    try {
      const directResponse = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(postData),
      });

      console.log('📡 Respuesta recibida:', {
        ok: directResponse.ok,
        status: directResponse.status,
        statusText: directResponse.statusText,
        headers: Object.fromEntries(directResponse.headers.entries())
      });

      if (directResponse.ok) {
        try {
          const directResult = await directResponse.json();
          console.log('📥 Respuesta de Google Sheets (POST directo):', directResult);
          
          if (directResult.success === true && typeof directResult.exists === 'boolean') {
            // Mostrar información de debug completa
            if (directResult.debug) {
              console.log('🔍 Debug info de Google Sheets:', {
                buscando: directResult.searched,
                totalFilas: directResult.totalRows,
                headers: directResult.debug.headers,
                emailColumnIndex: directResult.debug.emailColumnIndex,
                monthIdColumnIndex: directResult.debug.monthIdColumnIndex,
                primerasFilas: directResult.debug.firstFewRows
              });
              
              // Mostrar todas las columnas de las primeras filas
              if (directResult.debug.firstFewRows) {
                directResult.debug.firstFewRows.forEach((row: any) => {
                  console.log('📋 Fila ' + row.row + ':', {
                    email: row.email,
                    monthId: row.monthId,
                    monthIdOriginal: row.monthIdOriginal,
                    monthIdType: row.monthIdType,
                    todasLasColumnas: row.allColumns
                  });
                });
              }
            }
            
            // Mostrar todas las filas que coinciden con el email
            if (directResult.matchingEmails && directResult.matchingEmails.length > 0) {
              console.log('📧 Filas encontradas con el email "' + directResult.searched.email + '":', directResult.matchingEmails);
              directResult.matchingEmails.forEach((match: any) => {
                console.log('  - Fila ' + match.row + ': monthId="' + match.monthId + '" (original: "' + match.monthIdOriginal + '", tipo: ' + match.monthIdType + ')');
              });
            }
            
            if (!directResult.exists && directResult.totalRows > 0) {
              console.warn('⚠️ No se encontró coincidencia aunque hay', directResult.totalRows, 'filas en el sheet');
              console.warn('   Buscando:', directResult.searched);
              if (directResult.matchingEmails && directResult.matchingEmails.length > 0) {
                console.warn('   Se encontraron', directResult.matchingEmails.length, 'filas con el email correcto pero monthId diferente');
              } else {
                console.warn('   No se encontró ninguna fila con el email "' + directResult.searched.email + '"');
              }
            }
            
            return directResult.exists;
          } else if (directResult.success === false) {
            console.warn('⚠️ Google Sheets retornó error:', directResult.error);
            return false;
          } else {
            console.warn('⚠️ Respuesta inesperada de Google Sheets:', directResult);
            return false;
          }
        } catch (parseError) {
          // Intentar leer como texto para ver qué devolvió
          const textResponse = await directResponse.text();
          console.warn('⚠️ No se pudo parsear respuesta JSON:', textResponse);
          return false;
        }
      } else {
        const errorText = await directResponse.text().catch(() => 'No se pudo leer el error');
        console.warn('⚠️ POST no OK:', directResponse.status, directResponse.statusText, errorText);
        return false;
      }
    } catch (directError: any) {
      // Si falla por CORS u otro error de red
      console.warn('⚠️ POST directo falló:', directError.message, directError);
      // Retornar false para usar localStorage como fallback
      return false;
    }
    
    return false;
  } catch (error) {
    console.warn('⚠️ Error verificando en Google Sheets, usando localStorage:', error);
    return false;
  }
};

export const saveToGoogleSheets = async (review: GoogleSheetsReview): Promise<boolean> => {
  try {
    if (!GOOGLE_SCRIPT_URL) {
      console.warn('⚠️ Google Script URL not configured. Los datos solo se guardarán en localStorage.');
      console.warn('   Configura VITE_GOOGLE_SCRIPT_URL en GitHub Secrets o .env.local');
      return false;
    }

    console.log('📤 Enviando datos a Google Sheets...', {
      email: review.email,
      url: GOOGLE_SCRIPT_URL.substring(0, 50) + '...'
    });

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'append',
        data: {
          email: review.email,
          completion: review.completion,
          bugs: review.bugs,
          satisfaction: review.satisfaction,
          selfEvaluation: review.selfEvaluation || '',
          comments: review.comments || '',
          timestamp: review.timestamp,
          monthId: review.monthId,
          monthName: review.monthName,
        },
      }),
    });

    // Con text/plain podemos leer la respuesta
    if (response.ok) {
      try {
        const result = await response.json();
        console.log('✅ Datos guardados en Google Sheets:', result);
        return result.success === true;
      } catch (e) {
        // Si no se puede parsear, asumir éxito
        console.log('✅ Datos enviados a Google Sheets (respuesta no JSON)');
        return true;
      }
    }
    
    console.warn('⚠️ Respuesta no OK al guardar:', response.status);
    return false;
  } catch (error) {
    console.error('❌ Error saving to Google Sheets:', error);
    return false;
  }
};

