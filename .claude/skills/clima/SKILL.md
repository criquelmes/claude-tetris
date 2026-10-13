---
name: clima
description: Obtiene el clima actual y el pronóstico de 3 días. Por defecto muestra Pichilemu, Chile, salvo que el usuario indique otra ciudad. Úsala cuando el usuario pregunte por el clima, tiempo, temperatura, lluvia o pronóstico ("¿qué clima hace?", "¿va a llover mañana en Santiago?", "weather").
allowed-tools: Bash(bash .claude/skills/clima/scripts/clima.sh:*)
---

# Clima

Consulta el clima sin API key usando `wttr.in` (con respaldo automático en Open-Meteo).

## Cómo usarla

1. Si el usuario no menciona un lugar, ejecuta el script sin argumentos (siempre usa **Pichilemu, Chile** por defecto):
   ```bash
   bash .claude/skills/clima/scripts/clima.sh
   ```
2. Si menciona una ciudad, pásala como argumento:
   ```bash
   bash .claude/skills/clima/scripts/clima.sh "Santiago, Chile"
   ```
3. Responde en español con un resumen breve: condición actual, temperatura y sensación térmica, y lo relevante del pronóstico (p. ej. si va a llover). Responde directamente a lo que preguntó el usuario; no vuelques toda la salida si no hace falta.

## Notas

- No detectes la ubicación por IP ni preguntes la ciudad: si no se indica ninguna, el lugar es Pichilemu, Chile.
- Si se usa el respaldo de Open-Meteo, la condición viene como código WMO (0 despejado, 1–3 parcialmente nublado, 45/48 niebla, 51–67 llovizna/lluvia, 71–77 nieve, 80–82 chubascos, 95–99 tormenta); tradúcelo a texto.
- Requiere `curl` y `jq` y acceso a internet.
