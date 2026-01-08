export interface GoogleSheetsReview {
  email: string;
  completion: number;
  bugs: number;
  satisfaction: number;
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
export const checkIfResponseExists = async (email: string, monthId: string): Promise<boolean> => {
  try {
    if (!GOOGLE_SCRIPT_URL) {
      console.warn('⚠️ Google Script URL not configured. Usando solo localStorage.');
      return false;
    }

    console.log('🔍 Verificando en Google Sheets:', { email, monthId });

    // Google Apps Script no permite CORS, así que usamos no-cors
    // Esto significa que no podemos leer la respuesta, pero podemos intentar la petición
    // Por ahora, retornamos false y confiamos en localStorage
    // La verificación real se hace cuando se guarda (y sabemos que se guardó exitosamente)
    
    // Intentar con GET primero (a veces funciona sin CORS issues)
    try {
      const getUrl = new URL(GOOGLE_SCRIPT_URL);
      getUrl.searchParams.set('action', 'check');
      getUrl.searchParams.set('email', email);
      getUrl.searchParams.set('monthId', monthId);
      
      const getResponse = await fetch(getUrl.toString(), {
        method: 'GET',
      });

      if (getResponse.ok) {
        const getResult = await getResponse.json();
        console.log('📥 Respuesta de Google Sheets (GET):', getResult);
        
        if (typeof getResult.exists === 'boolean') {
          return getResult.exists;
        }
      }
    } catch (getError) {
      console.log('⚠️ GET falló, no se puede verificar desde Google Sheets debido a CORS');
    }
    
    // Si GET no funciona, no podemos verificar debido a CORS
    // Retornar false para usar localStorage como fallback
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
      mode: 'no-cors', // Google Apps Script no devuelve CORS headers
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'append',
        data: {
          email: review.email,
          completion: review.completion,
          bugs: review.bugs,
          satisfaction: review.satisfaction,
          comments: review.comments || '',
          timestamp: review.timestamp,
          monthId: review.monthId,
          monthName: review.monthName,
        },
      }),
    });

    // Con no-cors no podemos verificar la respuesta, pero asumimos éxito
    console.log('✅ Datos enviados a Google Sheets (modo no-cors)');
    return true;
  } catch (error) {
    console.error('❌ Error saving to Google Sheets:', error);
    return false;
  }
};

