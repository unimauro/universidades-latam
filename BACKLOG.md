# Backlog — Ranking de Universidades de Latinoamérica y España

**Live:** https://unimauro.github.io/universidades-latam/
**Repo:** https://github.com/unimauro/universidades-latam
**Carpeta local:** `/Users/unimauro/Documents/Repos/universidades-latam`

Ranking bibliométrico abierto y reproducible (OpenAlex CC0 + SCImago). 966 universidades auditadas, 21 países.

**Última actualización:** agosto 2026 · **Estado:** v1 publicado y en vivo · **Enriquecimiento calidad:** 200/966 (798 pendientes).

---

## ▶️ Por dónde retomar (próxima sesión)

Elegir uno según el objetivo del momento:

1. **Si el objetivo es que PRENDA (difusión):** armar la *munición de difusión* — 4-5 posts (LinkedIn/X/WhatsApp) con gancho por país + la tarjeta compartible. Es lo más barato y de mayor palanca; cierra el hueco de "no tuvo efecto". → ver P1.
2. **Si el objetivo es COMPLETAR los datos:** correr `etl/enriquecer.py` para llenar el %Q1 de las 798 restantes (esperar reset de cuota OpenAlex o poner ~$0.40 de saldo). → ver P0.
3. **Si el objetivo es MONETIZAR:** armar la capa B2B (3 CTAs: universidad / prensa / datos). → ver P2.
4. **Si el objetivo es SEO / que la prensa cite:** perfiles de universidad con deep-link `#u/<id>`. → ver P1.

**Recomendación:** hacer (1) difusión primero — el producto ya está bueno; lo que falta es que la gente lo vea y encuentre SU dato.

---

## ✅ Hecho (v1)

- Índice de impacto ponderado (h-index 45% + citas/pub 25% + volumen 15% + citas 15%), 966 universidades.
- **Auditoría de afiliaciones** (estilo Leiden/Percy): excluidos 31 centros/institutos + 1 colisión OpenAlex (Universidad de Londres MX = University of London UK, verificada por Box-Cox/Bradford Hill). Mega-colaboraciones (CERN) validadas, no excluidas.
- Filtro por región (LatAm / España / todo) + filtro por 21 países.
- Ranking por país (líder nacional + producción agregada + gráficos).
- Mapa Leaflet destacado (color por región, top 20 en dorado, leyenda).
- Comparador radar con **combobox buscador** (reemplazó el `<select>` nativo).
- **#1 crecimiento:** buscador "Encuentra tu universidad" en el hero + **tarjeta compartible PNG 1080×1080** (motor viral).
- **#2 crecimiento:** columna de **trayectoria ▲/▼ + sparkline** (excluye años parciales 2026/2027).
- UI premium: hero con podio del top 3 + constelación animada, tipografía Fraunces + Hanken Grotesk, tema día/noche, medallas y barra de índice en la tabla.
- Seguridad (`esc()` anti-XSS), bot IA (ai.tunky.net), barra Yape/WhatsApp/café.
- Google Analytics G-W0LNVD3V9W. SEO base (OG, sitemap, robots).

---

## 🔴 P0 — Datos e integridad (base de todo)

- [ ] **Completar enriquecimiento Q1-Q2 / per cápita / N&S** de las **798 universidades restantes** (hoy solo 200/966 tienen calidad). Bloqueo: OpenAlex introdujo cuota (1.000 req/día gratis, ~200 unis/día). Opciones: (a) re-correr `etl/enriquecer.py` tras cada reset UTC ~4 días (resume solo), o (b) ~$0.40 de saldo en openalex.org/pricing y correr una vez. Comando: `cd etl && /Users/unimauro/Documents/Repos/universidades-peru/etl/venv/bin/python enriquecer.py`.
- [ ] **Segunda pasada de auditoría** de colisiones/afiliaciones cuando esté el Q1 completo (revisar el caso flaggeado "National University College PR" y el clúster Puerto Rico con %Q1 alto por revistas US-indexed).
- [ ] **Recalcular el índice incorporando calidad (Q1-Q2)** una vez completo, para que el ranking premie excelencia y no solo impacto de citas.

## 🟠 P1 — Crecimiento y distribución (convertir tráfico en efecto)

- [ ] **Munición de difusión**: 4-5 posts listos (LinkedIn/X/WhatsApp) con ángulo por país + el dato que pica + la tarjeta. El gancho es lo local ("mi universidad es #X", "las 5 que más suben"), no el ranking global.
- [ ] **Press kit** descargable para periodistas de educación (las que más suben/caen, sorpresas, metodología en 1 página).
- [ ] **#3 Perfiles de universidad con deep-link** `#u/<id>` — ancla indexable por institución = SEO + enlace citable por prensa + tarjeta que apunta a algo. Hoy todo vive en un solo `index.html` sin superficie SEO por universidad.
- [ ] **#6 Captura de lead**: "Avísame cuando actualice / cuando salga el ranking de mi país" → alimenta VentIA. Señales de confianza: "Actualizado ago 2026", "Visto en…".

## 🟡 P2 — Monetización (B2B, el dinero)

- [ ] **#4 Capa B2B explícita** con 3 CTAs: (a) *"¿Eres una universidad?"* → perfil verificado + reporte de benchmark a medida (consultoría S/150/h); (b) *"¿Prensa?"* → press kit gratis; (c) *"¿Datos?"* → acceso al dataset/API (Signal-as-a-Service, captura email o pago).
- [ ] **#5 Descarga CSV/Excel + embed** (iframe/script "Inserta este ranking en tu web" → backlinks = SEO). El dataset completo puede ser de pago.

## 🔵 P3 — Producto avanzado (más pesado, requiere ETL)

- [ ] **Filtro por carrera/campo** ("mejor para medicina / ingeniería") — lo que busca un postulante. Requiere ETL de los `fields`/`topics` de OpenAlex por universidad.
- [ ] **Ventana temporal reciente** como métrica alternativa (índice sobre 2021-2025, estilo Leiden) además del acumulado.
- [ ] **Normalización por campo** (MNCS estilo Leiden) para no castigar humanidades.
- [ ] Serie histórica del ranking (posiciones año a año) cuando haya ≥2 snapshots.
- [ ] i18n (portugués para Brasil, inglés) — Brasil es 338 de las 966 universidades.

---

## Notas técnicas

- **Fuentes:** OpenAlex (CC0), SCImago SJR (parquet ikashnitsky/sjrdata). Sin presupuesto/patentes (no existen cross-country).
- **ETL:** `etl/pull_base.py` (bibliometría base), `etl/enriquecer.py` (Q1/per cápita/N&S, resumible). Venv reutilizado de universidades-peru.
- **Gotcha OpenAlex:** cuota diaria desde jul-2026; el `by` (serie anual) tiene 2026/2027 parciales → excluir en cálculos de tendencia.
- Dashboard estático (HTML+Chart.js+Leaflet, sin build). Deploy: GitHub Pages rama master.
