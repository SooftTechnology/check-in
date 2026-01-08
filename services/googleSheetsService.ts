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
/**
 * Verifica si ya existe una respuesta para un email y monthId en Google Sheets
 * Usa un proxy CORS para evitar problemas de CORS
 */
export const checkIfResponseExists = async (email: string, monthId: string): Promise<boolean> => {
  try {
    if (!GOOGLE_SCRIPT_URL) {
      console.warn('⚠️ Google Script URL not configured. Usando solo localStorage.');
      return false;
    }

    console.log('🔍 Verificando en Google Sheets:', { email, monthId });

    // Construir URL con parámetros
    const getUrl = new URL(GOOGLE_SCRIPT_URL);
    getUrl.searchParams.set('action', 'check');
    getUrl.searchParams.set('email', email);
    getUrl.searchParams.set('monthId', monthId);
    
    // Usar un proxy CORS para evitar problemas de CORS
    // Alternativamente, intentar directamente (a veces funciona)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(getUrl.toString())}`;
    
    try {
      // Intentar primero sin proxy
      const directResponse = await fetch(getUrl.toString(), {
        method: 'GET',
        mode: 'cors',
      });

      if (directResponse.ok) {
        const directResult = await directResponse.json();
        console.log('📥 Respuesta de Google Sheets (GET directo):', directResult);
        
        if (typeof directResult.exists === 'boolean') {
          return directResult.exists;
        }
      }
    } catch (directError) {
      console.log('⚠️ GET directo falló, intentando con proxy CORS...');
      
      // Si falla, usar proxy CORS
      try {
        const proxyResponse = await fetch(proxyUrl, {
          method: 'GET',
        });

        if (proxyResponse.ok) {
          const proxyResult = await proxyResponse.json();
          const content = JSON.parse(proxyResult.contents);
          console.log('📥 Respuesta de Google Sheets (vía proxy):', content);
          
          if (typeof content.exists === 'boolean') {
            return content.exists;
          }
        }
      } catch (proxyError) {
        console.warn('⚠️ Proxy CORS también falló:', proxyError);
      }
    }
    
    // Si todo falla, retornar false para usar localStorage
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

