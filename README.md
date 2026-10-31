# Academia CES

Plataforma de estudio tipo LMS para preparación del examen de residencia médica.
HTML, CSS y JavaScript puros — sin build, sin dependencias. Se publica en GitHub Pages.

## Modos

- **Recorrido por áreas** — quiz con corrección inmediata y explicación.
- **Simulacro por convocatoria** — el examen completo de un año (2018, 2021, 2022, 2023, 2024) con cronómetro.
- **Simulacro mixto** — 20 preguntas aleatorias contra reloj.
- **Flashcards** — tarjeta 3D, volteo y marcado "la sabía / repasar".
- **Repaso espaciado** — las falladas vuelven con más frecuencia (cajas de Leitner 0-5).
- **Biblioteca** — búsqueda y filtros por área y por año.
- **Galería** — todas las imágenes del material de estudio, agrupadas por documento y página, con visor ampliado.
- **Progreso** — dominio por área, historial y reinicio.

## Imágenes

`data/images.json` indexa las 3.633 imágenes extraídas de los 113 documentos originales
(PDF y DOCX), deduplicadas por hash y optimizadas a WebP (máx. 1200 px). Los archivos
viven en `assets/img/` con nombre derivado del hash.

Cada entrada: `{ "f": "<hash>.webp", "s": "<documento de origen>", "p": <página>, "w": 1200, "h": 1600 }`.

Las preguntas aceptan un campo opcional `"img": "assets/img/<hash>.webp"` que se muestra
sobre las opciones.


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
