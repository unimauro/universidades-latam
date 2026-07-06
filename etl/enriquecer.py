#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Enriquecer ranking LatAm+España con 3 indicadores de calidad.

Reutiliza la lógica probada de universidades-peru/etl/actualizar.py:
  1. Núcleo investigador (OpenAlex authors)  -> inv, cit_inv, pub_inv
  2. Nature & Science (ARWU N&S, group_by)    -> ns
  3. %Q1 / %Q1-Q2 (SCImago SJR por ISSN)      -> q1_pct, q12_pct

Escribe INCREMENTAL (cada 100 unis) sobre data/universidades.json,
preservando todas las claves y agregando solo los campos nuevos.
"""
import hashlib, json, math, os, subprocess, time
import requests

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data", "universidades.json")
CACHE = os.path.join(HERE, "cache")
MAILTO = "unimauro@gmail.com"
OA = "https://api.openalex.org"
SJR_ANIO = 2025
SJR_PARQUET = ("https://raw.githubusercontent.com/ikashnitsky/sjrdata/master/"
               "data-raw/sjr-journal/sjr_journals-2026.parquet")
ISSN_NS = "0028-0836|0036-8075"           # Nature, Science
MIN_WORKS_Q = 400
PAISES = ["es", "br", "mx", "ar", "co", "cl", "pe", "ec", "ve", "cu",
          "bo", "py", "uy", "cr", "pa", "gt", "hn", "sv", "ni", "do", "pr"]


def log(*a):
    print(*a, flush=True)


def get_json(url, intentos=5):
    os.makedirs(CACHE, exist_ok=True)
    ruta = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest() + ".json")
    if os.path.exists(ruta):
        with open(ruta) as f:
            return json.load(f)
    for i in range(intentos):
        try:
            r = requests.get(url, timeout=90,
                             headers={"User-Agent": f"observatorio-universidades-latam (mailto:{MAILTO})"})
            if r.status_code == 200:
                d = r.json()
                with open(ruta, "w") as f:
                    json.dump(d, f)
                time.sleep(0.12)
                return d
            if r.status_code in (429, 500, 502, 503):
                time.sleep(3 * (i + 1)); continue
            raise RuntimeError(f"HTTP {r.status_code}: {url[:140]}")
        except requests.RequestException:
            if i == intentos - 1:
                raise
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"agotados reintentos: {url[:140]}")


def issn8(s):
    return (s or "").replace("-", "").strip().upper()


def bare(oa):
    return oa.rsplit("/", 1)[1] if "/" in oa else oa


# ---------- SJR ----------
def cargar_sjr():
    import pandas as pd
    ruta = os.path.join(CACHE, "sjr_journals.parquet")
    if not os.path.exists(ruta):
        log("  descargando SJR parquet (~47MB)…")
        os.makedirs(CACHE, exist_ok=True)
        subprocess.run(["curl", "-sL", "--max-time", "600", "-o", ruta, SJR_PARQUET], check=True)
    df = pd.read_parquet(ruta)
    col_year = "year" if "year" in df.columns else next(c for c in df.columns if "year" in c.lower())
    df = df[df[col_year].astype(float).astype(int) == SJR_ANIO]
    col_q = next(c for c in df.columns if "quartile" in c.lower())
    col_issn = next(c for c in df.columns if c.lower() == "issn")
    m = {}
    for issn_raw, q in zip(df[col_issn], df[col_q]):
        q = str(q).strip().upper()
        if q not in ("Q1", "Q2", "Q3", "Q4"):
            continue
        for issn in str(issn_raw).replace(" ", "").split(","):
            issn = issn.strip().upper()
            if len(issn) == 8:
                if issn not in m or q < m[issn]:
                    m[issn] = q
    log(f"  SJR {SJR_ANIO}: {len(m):,} ISSN con cuartil")
    return m


# ---------- Nature & Science ----------
def contar_ns_region():
    """dict bare_institution_id -> n_papers en Nature&Science.

    Se consulta por país (group_by de institutions.id se limita a 200 grupos;
    hacerlo país por país garantiza cobertura de las universidades relevantes).
    """
    ns = {}
    for cc in PAISES:
        d = get_json(f"{OA}/works?filter=institutions.country_code:{cc},"
                     f"primary_location.source.issn:{ISSN_NS}"
                     f"&group_by=institutions.id&per-page=200&mailto={MAILTO}")
        for g in d.get("group_by", []):
            k = g.get("key") or ""
            if "/I" in k or k.startswith("I"):
                ns[bare(k)] = ns.get(bare(k), 0) + g["count"]
        log(f"    N&S {cc}: {len(d.get('group_by', []))} instituciones")
    return ns


def contar_investigadores(oa_id):
    d = get_json(f"{OA}/authors?filter=last_known_institutions.id:{oa_id},"
                 f"works_count:%3E4&per-page=1&mailto={MAILTO}")
    return d["meta"]["count"]


# ---------- Q1 ----------
def fuentes_uni(oa_id):
    d = get_json(f"{OA}/works?filter=institutions.id:{oa_id}"
                 f"&group_by=primary_location.source.id&per-page=200&mailto={MAILTO}")
    out = []
    for g in d.get("group_by", []):
        k = g.get("key") or ""
        if k.startswith("https://openalex.org/S"):
            out.append((k.rsplit("/", 1)[1], g["count"]))
    return out


def resolver_issn(source_ids, cache_issn):
    faltan = [s for s in source_ids if s not in cache_issn]
    for i in range(0, len(faltan), 50):
        lote = faltan[i:i + 50]
        d = get_json(f"{OA}/sources?filter=ids.openalex:{'|'.join(lote)}"
                     f"&per-page=50&select=id,issn_l,issn&mailto={MAILTO}")
        for s in d.get("results", []):
            sid = s["id"].rsplit("/", 1)[1]
            issns = set()
            if s.get("issn_l"):
                issns.add(issn8(s["issn_l"]))
            for x in s.get("issn") or []:
                issns.add(issn8(x))
            cache_issn[sid] = [x for x in issns if len(x) == 8]
        for s in lote:
            cache_issn.setdefault(s, [])


def calidad_q(fuentes, cache_issn, sjr):
    denom = q1 = q12 = 0
    for sid, n in fuentes:
        denom += n
        qs = [sjr[i] for i in cache_issn.get(sid, []) if i in sjr]
        if not qs:
            continue
        q = min(qs)
        if q == "Q1":
            q1 += n
        if q in ("Q1", "Q2"):
            q12 += n
    if not denom:
        return None, None
    return round(100 * q1 / denom, 1), round(100 * q12 / denom, 1)


def guardar(base):
    tmp = DATA + ".tmp"
    with open(tmp, "w") as f:
        json.dump(base, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, DATA)


def main():
    with open(DATA) as f:
        base = json.load(f)
    unis = base["unis"]
    log(f"Universidades: {len(unis)}")

    log("1) N&S región (por país)…")
    ns_map = contar_ns_region()
    for u in unis:
        u["ns"] = ns_map.get(bare(u["oa"]), 0)
    log(f"  N&S: {sum(1 for u in unis if u['ns'] > 0)} unis con >=1; total {sum(u['ns'] for u in unis)}")
    guardar(base)

    log("2) SJR parquet…")
    sjr = cargar_sjr()

    log("3) OpenAlex por universidad (inv + Q1)…")
    cache_issn = {}
    orden = sorted(unis, key=lambda x: -x.get("score", 0))
    n = len(orden)
    for i, u in enumerate(orden, 1):
        oa_id = bare(u["oa"])
        try:
            u["inv"] = contar_investigadores(oa_id)
        except Exception as e:
            log(f"  !! inv {u['name'][:40]}: {e}")
            u["inv"] = 0
        if u["inv"]:
            u["pub_inv"] = round(u["works"] / u["inv"], 1)
            u["cit_inv"] = round(u["cited"] / u["inv"], 1)
        else:
            u["pub_inv"] = None
            u["cit_inv"] = None
        if u["works"] >= MIN_WORKS_Q:
            try:
                fs = fuentes_uni(oa_id)
                resolver_issn([s for s, _ in fs], cache_issn)
                q1, q12 = calidad_q(fs, cache_issn, sjr)
                if q1 is not None:
                    u["q1_pct"], u["q12_pct"] = q1, q12
            except Exception as e:
                log(f"  !! q1 {u['name'][:40]}: {e}")
        if i % 100 == 0 or i == n:
            guardar(base)
            log(f"  {i}/{n} guardado ({u['name'][:35]})")

    guardar(base)
    # resumen
    ci = sum(1 for u in unis if u.get("inv"))
    cq = sum(1 for u in unis if u.get("q1_pct") is not None)
    cn = sum(1 for u in unis if u.get("ns", 0) > 0)
    log(f"LISTO ✓  inv={ci}  q1_pct={cq}  ns>0={cn}  ns_total={sum(u['ns'] for u in unis)}")


if __name__ == "__main__":
    main()
