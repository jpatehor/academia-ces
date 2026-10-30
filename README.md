# Academia CES

Plataforma de estudio tipo LMS para preparación del examen de residencia médica.
HTML, CSS y JavaScript puros — sin build, sin dependencias. Se publica en GitHub Pages.

## Modos

- **Recorrido por áreas** — quiz con corrección inmediata y explicación.
- **Flashcards** — tarjeta 3D, volteo y marcado "la sabía / repasar".
- **Simulacro** — 20 preguntas, cronómetro y resultados al final.
- **Repaso espaciado** — las falladas vuelven con más frecuencia (cajas de Leitner 0-5).
- **Biblioteca** — búsqueda y filtro por área.
- **Progreso** — dominio por área, historial y reinicio.

## Audio

Cada pregunta y cada explicación se pueden escuchar con la Web Speech API del navegador
(es-ES). No requiere archivos ni servicios externos.

## Datos

`data/questions.json` — banco activo. Esquema:

```json
{
  "id": "cb-001",
  "area": "ciencias-basicas | clinicas | cultura-general",
  "tema": "Bioquímica · Termodinámica",
  "fuente": "CES 2018 · reconstruido",
  "anio": 2018,
  "enunciado": "…",
  "opciones": ["…", "…", "…", "…"],
  "correcta": 1,
  "pista": "…",
  "explicacion": "…"
}
```

## Avance

Todo el progreso vive en `localStorage` (`academia-ces.v1`). No hay backend ni cuentas.
