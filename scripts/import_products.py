#!/usr/bin/env python3
"""
Crée ou met à jour des produits Strapi à partir d'un CSV, avec catégories
et sous-catégories (détectées automatiquement d'après le nom).

Colonnes : slug (facultatif), name, category (stylos | accessoires),
subcategory (facultatif : force une sous-catégorie), short (facultatif),
description, formats (ex. "Boîte de 10=12,90|Boîte de 50=49"), price, image

  python scripts/import_products.py scripts/products_new.csv --dry-run
  python scripts/import_products.py scripts/products_new.csv

Variables : STRAPI_URL (défaut http://localhost:1337), STRAPI_TOKEN.
"""
import argparse
import csv
import mimetypes
import os
import re
import sys
import unicodedata

import requests
from dotenv import load_dotenv
load_dotenv()

STRAPI_URL = os.environ.get("STRAPI_URL", "http://localhost:1337").rstrip("/")
STRAPI_TOKEN = os.environ.get("STRAPI_TOKEN", "")
HEAD = {"Authorization": f"Bearer {STRAPI_TOKEN}"}
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")

# Catégories principales
TOP = {
    "accessoires": {"label": "Accessoires", "icon": "grid"},
    "stylos": {"label": "Stylos", "icon": "flask"},
}

# Sous-catégories : slug -> (catégorie principale, libellé)
SUBS = {
    # Accessoires
    "accessoires-stylos": ("accessoires", "Accessoires stylos"),
    "accessoires-fioles": ("accessoires", "Accessoires fioles"),
    "accessoires-autres": ("accessoires", "Autres"),
    # Stylos, par famille
    "stylos-peptides": ("stylos", "Peptides"),
    "stylos-esthetique-cosmetique": ("stylos", "Esthétique et cosmétique"),
    "stylos-immunite-inflammation": ("stylos", "Immunité et inflammation"),
    "stylos-metabolisme-energie": ("stylos", "Métabolisme cellulaire et énergie"),
    "stylos-autres": ("stylos", "Autres stylos"),
}

# Règles de détection automatique d'après le nom (la 1re qui correspond gagne).
# Une valeur écrite dans la colonne « subcategory » du CSV l'emporte toujours.
RULES = {
    "accessoires": [
        (r"stylo|\bpen\b|cartouche|recharge|embout", "accessoires-stylos"),
        (r"fiole|flacon|\bvial|bouchon|septum|capsule|sertiss|\beau\b|seringue", "accessoires-fioles"),
    ],
    "stylos": [
        (r"retatrutide|tirzepatide|semaglutide|cagrilintide", "stylos-peptides"),
        (r"ghk|snap|\bmt-?[12]\b", "stylos-esthetique-cosmetique"),
        (r"glow|klow|\bkpv\b", "stylos-immunite-inflammation"),
        (r"mots-?c|nad|epitalon", "stylos-metabolisme-energie"),
    ],
}
DEFAULT_SUB = {"accessoires": "accessoires-autres", "stylos": "stylos-autres"}


def plain(text):
    text = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode()
    return text.lower()


def slugify(text):
    return re.sub(r"[^a-z0-9]+", "-", plain(text)).strip("-")


def to_number(text):
    return float(text.replace("€", "").replace(",", ".").strip())


def parse_formats(text):
    variants = []
    for part in text.split("|"):
        part = part.strip()
        if not part:
            continue
        label, _, price = part.rpartition("=")
        if not label.strip():
            raise ValueError(f"format invalide « {part} » (attendu : libellé=prix)")
        variants.append({"label": label.strip(), "price": to_number(price)})
    return variants


def detect_sub(top, name, short, forced):
    if forced:
        wanted = plain(forced).strip()
        for slug, (parent, label) in SUBS.items():
            if parent == top and wanted in (slug, plain(label)):
                return slug
        raise ValueError(f"sous-catégorie « {forced} » inconnue pour {top}")
    text = plain(f"{name} {short}")
    for pattern, slug in RULES[top]:
        if re.search(pattern, text):
            return slug
    return DEFAULT_SUB[top]


def check(r):
    if not r.ok:
        sys.exit(f"Erreur Strapi {r.status_code} : {r.text[:400]}")
    return r.json()


_cache = {}


def ensure_category(slug, label, icon, parent_doc_id=None):
    if slug in _cache:
        return _cache[slug]
    r = requests.get(
        f"{STRAPI_URL}/api/categories",
        headers=HEAD,
        params={"filters[slug][$eq]": slug},
        timeout=90,
    )
    data = check(r)["data"]
    if data:
        doc_id = data[0]["documentId"]
    else:
        body = {"slug": slug, "label": label, "icon": icon}
        if parent_doc_id:
            body["parent"] = {"set": [parent_doc_id]}
        r = requests.post(
            f"{STRAPI_URL}/api/categories", headers=HEAD, json={"data": body}, timeout=90
        )
        doc_id = check(r)["data"]["documentId"]
        print(f"catégorie créée : {label}")
    _cache[slug] = doc_id
    return doc_id


def upload_image(filename):
    path = os.path.join(IMAGES_DIR, filename)
    if not os.path.isfile(path):
        sys.exit(f"Image introuvable : {path}")
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as fh:
        r = requests.post(
            f"{STRAPI_URL}/api/upload",
            headers=HEAD,
            files={"files": (filename, fh, mime)},
            timeout=180,
        )
    return check(r)[0]["id"]


def find_product(slug):
    r = requests.get(
        f"{STRAPI_URL}/api/products",
        headers=HEAD,
        params={"filters[slug][$eq]": slug},
        timeout=90,
    )
    data = check(r)["data"]
    return data[0] if data else None


def read_rows(path):
    with open(path, newline="", encoding="utf-8-sig") as fh:
        first = fh.readline()
        fh.seek(0)
        delimiter = ";" if first.count(";") > first.count(",") else ","
        return list(csv.DictReader(fh, delimiter=delimiter))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv_file")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not args.dry_run and not STRAPI_TOKEN:
        sys.exit("STRAPI_TOKEN manquant.")

    items, errors = [], []
    for n, row in enumerate(read_rows(args.csv_file), start=2):  # ligne 1 = en-têtes
        name = (row.get("name") or "").strip()
        if not name:
            continue
        top = plain((row.get("category") or "").strip())
        description = (row.get("description") or "").strip()
        short = (row.get("short") or "").strip()
        try:
            if top not in TOP:
                raise ValueError(f"catégorie « {top} » inconnue (stylos ou accessoires)")
            if not description:
                raise ValueError("description obligatoire")
            sub = detect_sub(top, name, short, (row.get("subcategory") or "").strip())
            data = {
                "slug": (row.get("slug") or "").strip() or slugify(name),
                "name": name,
                "description": description,
            }
            if short:
                data["short"] = short
            if (row.get("formats") or "").strip():
                data["variants"] = parse_formats(row["formats"])
            elif (row.get("price") or "").strip():
                data["price"] = to_number(row["price"])
            items.append((top, sub, (row.get("image") or "").strip(), data))
        except ValueError as exc:
            errors.append(f"ligne {n} ({name}) : {exc}")

    for e in errors:
        print("ERREUR", e)
    if errors:
        sys.exit("Corrige le fichier puis relance.")

    print(f"Cible : {STRAPI_URL}\n{len(items)} produits lus.\n")
    for top, sub, image, data in items:
        prix = data.get("variants") or data.get("price") or "prix sur demande"
        print(f"- {data['slug']} [{TOP[top]['label']} > {SUBS[sub][1]}] {prix}"
              f"{' + image ' + image if image else ''}")
    if args.dry_run:
        print("\n(simulation : rien n'a été envoyé)")
        return

    for top, sub, image, data in items:
        top_id = ensure_category(top, TOP[top]["label"], TOP[top]["icon"])
        sub_id = ensure_category(sub, SUBS[sub][1], TOP[top]["icon"], parent_doc_id=top_id)
        data["category"] = {"set": [sub_id]}
        if image:
            data["image"] = upload_image(image)

        existing = find_product(data["slug"])
        if existing:
            check(requests.put(f"{STRAPI_URL}/api/products/{existing['documentId']}",
                               headers=HEAD, json={"data": data}, timeout=90))
            print(f"mis à jour : {data['slug']}")
        else:
            check(requests.post(f"{STRAPI_URL}/api/products",
                                headers=HEAD, json={"data": data}, timeout=90))
            print(f"créé : {data['slug']}")


if __name__ == "__main__":
    main()