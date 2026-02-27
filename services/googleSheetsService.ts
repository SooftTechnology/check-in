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
      return false;
    }

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

      if (directResponse.ok) {
        try {
          const directResult = await directResponse.json();
          
          if (directResult.success === true && typeof directResult.exists === 'boolean') {
            return directResult.exists;
          } else if (directResult.success === false) {
            return false;
          } else {
            return false;
          }
        } catch (parseError) {
          // Intentar leer como texto para ver qué devolvió
          const textResponse = await directResponse.text();
          return false;
        }
      } else {
        const errorText = await directResponse.text().catch(() => 'No se pudo leer el error');
        return false;
      }
    } catch (directError: any) {
      // Si falla por CORS u otro error de red, usar localStorage como fallback
      return false;
    }
    
    return false;
  } catch (error) {
    return false;
  }
};

export const saveToGoogleSheets = async (review: GoogleSheetsReview): Promise<boolean> => {
  try {
    if (!GOOGLE_SCRIPT_URL) {
      return false;
    }

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
        return result.success === true;
      } catch (e) {
        // Si no se puede parsear, asumir éxito
        return true;
      }
    }

    return false;
  } catch (error) {
    return false;
  }
};

