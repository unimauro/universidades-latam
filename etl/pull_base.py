#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Pull base OpenAlex — universidades de LatAm + España (works>1000).
Baja bibliometría acumulada + serie anual + campos + geo. Sin presupuesto/patentes
(no existen cross-country). Escribe data/universidades-latam-raw.json."""
import urllib.request, json, os, time
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,"..","data")
ML="mailto=unimauro@gmail.com"
P="es|br|mx|ar|co|cl|pe|ec|ve|cu|bo|py|uy|cr|pa|gt|hn|sv|ni|do|pr"
SEL="id,display_name,country_code,works_count,cited_by_count,summary_stats,counts_by_year,geo,ids,type"
def get(url):
    for i in range(4):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"})
            return json.loads(urllib.request.urlopen(req,timeout=60).read().decode())
        except Exception as e:
            print("  retry",i,repr(e)[:60]); time.sleep(5)
    return None
unis=[]; cursor="*"; page=0
while cursor:
    url=f"https://api.openalex.org/institutions?filter=country_code:{P},type:education,works_count:>1000&select={SEL}&per-page=200&cursor={cursor}&{ML}"
    d=get(url)
    if not d: break
    for r in d.get("results",[]):
        ss=r.get("summary_stats",{})
        by=[{"y":c["year"],"w":c["works_count"],"c":c["cited_by_count"]} for c in r.get("counts_by_year",[])]
        by.sort(key=lambda x:x["y"])
        g=r.get("geo",{}) or {}
        unis.append({
            "oa":r["id"].split("/")[-1], "name":r["display_name"], "cc":r.get("country_code"),
            "works":r["works_count"], "cited":r["cited_by_count"],
            "h":ss.get("h_index"), "i10":ss.get("i10_index"), "mcit":round(ss.get("2yr_mean_citedness",0),2),
            "by":by, "city":g.get("city"), "lat":g.get("latitude"), "lng":g.get("longitude"),
            "ror":(r.get("ids",{}) or {}).get("ror")
        })
    cursor=d.get("meta",{}).get("next_cursor"); page+=1
    print(f"pág {page}: {len(unis)} unis acumuladas", flush=True); time.sleep(0.3)
os.makedirs(OUT,exist_ok=True)
json.dump(unis,open(os.path.join(OUT,"universidades-latam-raw.json"),"w",encoding="utf-8"),ensure_ascii=False,separators=(",",":"))
print(f"OK -> {len(unis)} universidades", flush=True)
# resumen por país
from collections import Counter
c=Counter(u["cc"] for u in unis)
print("por país:",dict(sorted(c.items(),key=lambda x:-x[1])))
