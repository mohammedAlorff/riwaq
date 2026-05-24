#!/bin/sh
# رواق — خادم تطوير سريع
set -e

PORT="${PORT:-8000}"
URL="http://localhost:${PORT}/رواق.html"

echo "============================================"
echo "  Riwaq - Dev Server"
echo "============================================"
echo
echo "Starting PHP built-in server on port ${PORT}..."
echo
echo "Open in browser:"
echo "  - Students:   ${URL}"
echo "  - Presidents: http://localhost:${PORT}/presidents/"
echo "  - Admin:      http://localhost:${PORT}/admin/"
echo
echo "Press Ctrl+C to stop the server."
echo "============================================"
echo

# افتح المتصفح بعد ثانية (يعمل على macOS و Linux)
(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
  fi
) &

php -S "0.0.0.0:${PORT}"
