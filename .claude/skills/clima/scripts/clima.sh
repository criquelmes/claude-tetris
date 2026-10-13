#!/usr/bin/env bash
# Fetch current weather + 3-day forecast. No API key required.
# Usage: clima.sh [location]   (no argument = Pichilemu, Chile)
# Primary source: wttr.in. Fallback: Open-Meteo (geocoding + forecast).
set -euo pipefail

LOC="${*:-Pichilemu, Chile}"
ENC_LOC=$(printf '%s' "$LOC" | jq -sRr @uri)

from_wttr() {
  local json
  json=$(curl -fsS -m 20 "https://wttr.in/${ENC_LOC}?format=j1&lang=es") || return 1
  echo "$json" | jq -er '
    .nearest_area[0] as $a
    | .current_condition[0] as $c
    | "Ubicación: \($a.areaName[0].value), \($a.region[0].value), \($a.country[0].value)",
      "Actual: \($c.lang_es[0].value // $c.weatherDesc[0].value)",
      "Temperatura: \($c.temp_C)°C (sensación \($c.FeelsLikeC)°C)",
      "Humedad: \($c.humidity)%  Viento: \($c.windspeedKmph) km/h \($c.winddir16Point)  Precipitación: \($c.precipMM) mm",
      "",
      "Pronóstico:",
      (.weather[] | "  \(.date): mín \(.mintempC)°C / máx \(.maxtempC)°C, prob. lluvia \([.hourly[].chanceofrain | tonumber] | max)%")
  '
}

from_open_meteo() {
  local lat lon name
  # Open-Meteo geocoding matches city names only, so drop any ", country" suffix.
  local city
  city=$(printf '%s' "${LOC%%,*}" | jq -sRr @uri)
  read -r lat lon name < <(curl -fsS -m 10 \
    "https://geocoding-api.open-meteo.com/v1/search?count=1&language=es&name=${city}" \
    | jq -er '.results[0] | "\(.latitude) \(.longitude) \(.name), \(.country)"') || return 1
  curl -fsS -m 10 "https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max&forecast_days=3&timezone=auto" \
    | jq -er --arg name "$name" '
      .current as $c
      | "Ubicación: \($name)",
        "Código WMO: \($c.weather_code)",
        "Temperatura: \($c.temperature_2m)°C (sensación \($c.apparent_temperature)°C)",
        "Humedad: \($c.relative_humidity_2m)%  Viento: \($c.wind_speed_10m) km/h  Precipitación: \($c.precipitation) mm",
        "",
        "Pronóstico:",
        (.daily as $d | range(0; $d.time | length)
          | "  \($d.time[.]): mín \($d.temperature_2m_min[.])°C / máx \($d.temperature_2m_max[.])°C, prob. lluvia \($d.precipitation_probability_max[.])%")
    '
}

if ! from_wttr 2>/dev/null; then
  echo "(wttr.in no disponible, usando Open-Meteo)" >&2
  from_open_meteo || { echo "Error: no se pudo obtener el clima." >&2; exit 1; }
fi
