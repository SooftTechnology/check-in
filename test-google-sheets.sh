#!/bin/bash

# Script de prueba para enviar datos a Google Sheets usando curl
# 
# Uso:
# ./test-google-sheets.sh <URL_DEL_GOOGLE_SCRIPT>

if [ -z "$1" ]; then
  echo "❌ Error: Debes proporcionar la URL del Google Apps Script"
  echo ""
  echo "Uso:"
  echo "  ./test-google-sheets.sh <URL_DEL_GOOGLE_SCRIPT>"
  echo ""
  echo "Ejemplo:"
  echo "  ./test-google-sheets.sh https://script.google.com/macros/s/AKfycby.../exec"
  exit 1
fi

GOOGLE_SCRIPT_URL="$1"

# Datos de prueba
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
MONTH_ID=$(date '+%Y-%m')
MONTH_NAME=$(date '+%B %Y')

echo "🚀 Enviando datos de prueba a Google Sheets..."
echo ""
echo "📊 Datos a enviar:"
echo "  Email: test@sooft.tech"
echo "  Completitud: 85%"
echo "  Bugs: 2"
echo "  Satisfacción: 4"
echo "  Comentarios: Esta es una prueba desde el script de test"
echo "  Timestamp: $TIMESTAMP"
echo "  Month ID: $MONTH_ID"
echo "  Month Name: $MONTH_NAME"
echo ""
echo "📡 URL: $GOOGLE_SCRIPT_URL"
echo ""

# Enviar datos usando curl
curl -X POST "$GOOGLE_SCRIPT_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"append\",
    \"data\": {
      \"email\": \"test@sooft.tech\",
      \"completion\": 85,
      \"bugs\": 2,
      \"satisfaction\": 4,
      \"comments\": \"Esta es una prueba desde el script de test\",
      \"timestamp\": \"$TIMESTAMP\",
      \"monthId\": \"$MONTH_ID\",
      \"monthName\": \"$MONTH_NAME\"
    }
  }"

echo ""
echo ""
echo "✨ ¡Prueba completada!"
echo "📋 Verifica tu Google Sheet para ver si los datos se guardaron correctamente."
echo "🔗 https://docs.google.com/spreadsheets/d/1Kxu7-T_ArqZ5dqV3Xw8D8Bo4tZsmTtBZggDWey-hUsA/edit"

