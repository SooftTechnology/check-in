/**
 * Script de prueba para enviar datos a Google Sheets
 * 
 * Uso:
 * node test-google-sheets.js <URL_DEL_GOOGLE_SCRIPT>
 * 
 * O configura la variable de entorno:
 * export VITE_GOOGLE_SCRIPT_URL="tu_url_aqui"
 * node test-google-sheets.js
 */

const GOOGLE_SCRIPT_URL = process.argv[2] || process.env.VITE_GOOGLE_SCRIPT_URL;

if (!GOOGLE_SCRIPT_URL) {
  console.error('❌ Error: Debes proporcionar la URL del Google Apps Script');
  console.log('\nUso:');
  console.log('  node test-google-sheets.js <URL_DEL_GOOGLE_SCRIPT>');
  console.log('\nO configura la variable de entorno:');
  console.log('  export VITE_GOOGLE_SCRIPT_URL="tu_url_aqui"');
  console.log('  node test-google-sheets.js');
  process.exit(1);
}

// Datos de prueba
const testData = {
  action: 'append',
  data: {
    email: 'test@sooft.tech',
    completion: 85,
    bugs: 2,
    satisfaction: 4,
    comments: 'Esta es una prueba desde el script de test',
    timestamp: new Date().toLocaleString('es-ES'),
    monthId: new Date().toISOString().slice(0, 7),
    monthName: new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' })
  }
};

console.log('🚀 Enviando datos de prueba a Google Sheets...');
console.log('\n📊 Datos a enviar:');
console.log(JSON.stringify(testData, null, 2));
console.log('\n📡 URL:', GOOGLE_SCRIPT_URL);

fetch(GOOGLE_SCRIPT_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(testData),
})
  .then(response => {
    console.log('\n✅ Estado de la respuesta:', response.status, response.statusText);
    // Intentar leer la respuesta si es posible
    if (response.ok) {
      return response.text().then(text => {
        try {
          const json = JSON.parse(text);
          console.log('📥 Respuesta:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('📥 Respuesta (texto):', text);
        }
      });
    }
  })
  .then(() => {
    console.log('\n✨ ¡Prueba completada!');
    console.log('📋 Verifica tu Google Sheet para ver si los datos se guardaron correctamente.');
    console.log('🔗 https://docs.google.com/spreadsheets/d/1Kxu7-T_ArqZ5dqV3Xw8D8Bo4tZsmTtBZggDWey-hUsA/edit');
  })
  .catch(error => {
    console.error('\n❌ Error al enviar datos:', error.message);
    console.log('\n💡 Nota: Si ves un error de CORS, es normal. Google Apps Script con "no-cors" no devuelve respuesta.');
    console.log('   Verifica directamente en tu Google Sheet si los datos se guardaron.');
  });

