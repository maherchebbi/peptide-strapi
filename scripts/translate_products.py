#!/usr/bin/env python3
"""
Traduit les fiches produits et les catégories de Strapi (FR -> EN) avec DeepL
et enregistre le résultat dans le champ JSON « translations » (clé "en").

Usage :
  python3 scripts/translate_products.py --dry-run         # compte seulement
  python3 scripts/translate_products.py --only SLUG       # une seule fiche (test)
  python3 scripts/translate_products.py                   # fiches sans traduction
  python3 scripts/translate_products.py --force           # retraduit tout

Variables d'environnement : STRAPI_URL (défaut http://localhost:1337),
STRAPI_TOKEN, DEEPL_KEY. Aucune clé n'est écrite dans ce fichier.
"""
import argparse
import os
import re
import sys
import time

import requests

STRAPI_URL = os.environ.get("STRAPI_URL", "http://localhost:1337").rstrip("/")
STRAPI_TOKEN = os.environ.get("STRAPI_TOKEN", "")
DEEPL_KEY = os.environ.get("DEEPL_KEY", "")
DEEPL_URL = (
    "https://api-free.deepl.com/v2/translate"
    if DEEPL_KEY.endswith(":fx")
    else "https://api.deepl.com/v2/translate"
)
HEAD = {"Authorization": f"Bearer {STRAPI_TOKEN}"}

TR = "translate"  # marqueur : ce champ doit être traduit

# ---- Quels champs traduire (même forme que les données de Strapi) ----
PRODUCT_SPEC = {
    "description": TR,
    "short": TR,
    "subtitle": TR,
    "status": TR,
    "intro": TR,
    "purityNote": TR,
    "facts": [{"label": TR, "value": TR, "note": TR}],
    "chemistry": [{"label": TR, "value": TR}],
    "highlights": [{"title": TR, "text": TR}],
    "mechanism": [{"text": TR}],
    "history": [{"title": TR, "text": TR}],
    "handling": [{"text": TR}],
    "storage": [{"label": TR, "text": TR}],
    "safety": [{"text": TR}],
    "timeline": [{"period": TR, "text": TR}],
    # Titres des synergies = noms de produits (servent à retrouver la fiche) : on ne les traduit pas
    "synergies": [{"text": TR}],
    "stacks": [{"title": TR, "text": TR}],
    "sideEffects": [{"text": TR}],
    "extraSections": [{"title": TR, "text": TR}],
    "dosage": {
        "cycleLabel": TR,
        "timing": TR,
        "halfLife": TR,
        "applicationText": TR,
        "disclaimer": TR,
        "referenceDosages": [{"level": TR, "description": TR}],
        "titrationPhases": [{"periodLabel": TR, "durationLabel": TR, "description": TR}],
        "reconstitution": {"vialLabel": TR, "diluentLabel": TR, "originalText": TR},
        "notes": [{"text": TR}],
        "relatedSections": [{"title": TR, "text": TR}],
        "extraStats": [{"label": TR, "value": TR, "note": TR}],
    },
}
CATEGORY_SPEC = {"label": TR}

# Même liste que le site (app/lib/shop.ts) pour recevoir tous les composants
POPULATE = "&".join(
    [
        "populate[category]=true",
        "populate[variants]=true",
        "populate[facts]=true",
        "populate[chemistry]=true",
        "populate[highlights]=true",
        "populate[mechanism]=true",
        "populate[history]=true",
        "populate[handling]=true",
        "populate[storage]=true",
        "populate[safety]=true",
        "populate[references]=true",
        "populate[timeline]=true",
        "populate[synergies]=true",
        "populate[stacks]=true",
        "populate[sideEffects]=true",
        "populate[extraSections]=true",
        "populate[dosage][populate][referenceDosages]=true",
        "populate[dosage][populate][titrationPhases]=true",
        "populate[dosage][populate][reconstitution]=true",
        "populate[dosage][populate][notes]=true",
        "populate[dosage][populate][relatedSections]=true",
        "populate[dosage][populate][extraStats]=true",
    ]
)


def should_translate(s):
    """Évite les codes, formules et nombres (ex. C62H98N16O22, 62031-54-3, 10)."""
    if not isinstance(s, str):
        return False
    s = s.strip()
    if len(s) < 3 or not re.search(r"[A-Za-zÀ-ÿ]", s):
        return False
    if " " not in s and (re.search(r"\d", s) or s.isupper()):
        return False
    return True


def post_fix(text):
    """Harmonise les libellés que le site détecte dans les textes."""
    return re.sub(r"(?im)^(\s*)why (this|it) works", r"\1Why it works", text)


def build_overlay(spec, data, jobs):
    """Construit la version « traduite » : mêmes clés, mêmes positions dans les listes."""
    if isinstance(spec, list):
        if not isinstance(data, list):
            return None
        return [build_overlay(spec[0], item, jobs) or {} for item in data]
    if isinstance(spec, dict):
        if not isinstance(data, dict):
            return None
        out = {}
        for key, sub in spec.items():
            value = data.get(key)
            if value is None or value == "":
                continue
            if sub == TR:
                if should_translate(value):
                    out[key] = None  # rempli après la traduction
                    jobs.append((out, key, value))
            else:
                res = build_overlay(sub, value, jobs)
                if res is not None:
                    out[key] = res
        return out
    return None


def fetch_all(path, extra=""):
    page, items = 1, []
    while True:
        url = f"{STRAPI_URL}{path}?pagination[page]={page}&pagination[pageSize]=100&sort=id:asc{extra}"
        r = requests.get(url, headers=HEAD, timeout=60)
        r.raise_for_status()
        body = r.json()
        items += body["data"]
        if page >= body["meta"]["pagination"]["pageCount"]:
            return items
        page += 1


def translate_texts(texts):
    out, i = [], 0
    while i < len(texts):
        batch, chars = [], 0
        while i < len(texts) and len(batch) < 40 and chars + len(texts[i]) < 40000:
            batch.append(texts[i])
            chars += len(texts[i])
            i += 1
        if not batch:  # un seul texte très long
            batch = [texts[i]]
            i += 1
        for attempt in range(4):
            r = requests.post(
                DEEPL_URL,
                headers={"Authorization": f"DeepL-Auth-Key {DEEPL_KEY}"},
                json={
                    "text": batch,
                    "source_lang": "FR",
                    "target_lang": "EN-GB",
                    "preserve_formatting": True,
                },
                timeout=120,
            )
            if r.status_code == 456:
                sys.exit("Quota DeepL épuisé pour ce mois.")
            if r.status_code in (429, 500, 502, 503, 504):
                time.sleep(2 * (attempt + 1))
                continue
            r.raise_for_status()
            break
        else:
            sys.exit("DeepL ne répond pas, réessaie plus tard.")
        out += [t["text"] for t in r.json()["translations"]]
        print(f"  traduit {len(out)}/{len(texts)}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--only")
    args = ap.parse_args()

    if not STRAPI_TOKEN:
        sys.exit("STRAPI_TOKEN manquant (export STRAPI_TOKEN=...)")
    if not args.dry_run and not DEEPL_KEY:
        sys.exit("DEEPL_KEY manquant (export DEEPL_KEY=...)")

    products = fetch_all("/api/products", "&" + POPULATE)
    categories = fetch_all("/api/categories")
    if args.only:
        products = [p for p in products if p["slug"] == args.only]
        categories = []
        if not products:
            sys.exit(f"Aucun produit avec le slug « {args.only} ».")

    jobs, plan = [], []
    for p in products:
        if not args.force and (p.get("translations") or {}).get("en"):
            continue
        overlay = build_overlay(PRODUCT_SPEC, p, jobs) or {}
        plan.append(("/api/products", p["documentId"], p.get("translations"), overlay, p["slug"]))
    for c in categories:
        if not args.force and (c.get("translations") or {}).get("en"):
            continue
        overlay = build_overlay(CATEGORY_SPEC, c, jobs) or {}
        plan.append(("/api/categories", c["documentId"], c.get("translations"), overlay, c["slug"]))

    total = sum(len(j[2]) for j in jobs)
    print(f"{len(plan)} éléments à traduire, {len(jobs)} textes, {total} caractères.")
    if args.dry_run or not jobs:
        return

    results = translate_texts([j[2] for j in jobs])
    for (container, key, _), text in zip(jobs, results):
        container[key] = post_fix(text)

    for path, doc_id, existing, overlay, slug in plan:
        translations = dict(existing or {})
        translations["en"] = overlay
        r = requests.put(
            f"{STRAPI_URL}{path}/{doc_id}",
            headers=HEAD,
            json={"data": {"translations": translations}},
            timeout=60,
        )
        r.raise_for_status()
        print(f"enregistré : {slug}")


if __name__ == "__main__":
    main()