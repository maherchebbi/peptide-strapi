#!/usr/bin/env python3
"""
Remplace les formats (variantes) et leurs prix pour une liste de produits Strapi.

Usage :
  python scripts/set_prices.py --dry-run   # affiche avant/après, ne modifie rien
  python scripts/set_prices.py             # applique

Variables d'environnement : STRAPI_URL (défaut http://localhost:1337) et STRAPI_TOKEN.
"""
import argparse
import os
import sys

import requests

STRAPI_URL = os.environ.get("STRAPI_URL", "http://localhost:1337").rstrip("/")
STRAPI_TOKEN = os.environ.get("STRAPI_TOKEN", "")
HEAD = {"Authorization": f"Bearer {STRAPI_TOKEN}"}

# slug -> [(libellé du format, prix en €)]
# Le libellé doit contenir « NN mg » : le site s'en sert pour le calculateur de protocole.
PRICES = {
    "retatrutide": [
        ("10 mg", 49.99),
        ("15 mg", 69.99),
        ("20 mg", 99.99),
        ("30 mg", 129.99),
        ("40 mg", 149.99),
    ],
    "ghk-cu": [
        ("50 mg", 29.99),
        ("100 mg", 49.99),
    ],
    "mots-c": [
        ("10 mg", 29.99),
        ("20 mg", 49.99),
        ("40 mg", 89.99),
    ],
    "cagrilintide-am833": [
        ("5 mg", 54.99),
        ("10 mg", 69.99),
    ],
    "tirzepatide": [
        ("10 mg", 34.99),
        ("20 mg", 49.99),
        ("30 mg", 64.99),
        ("40 mg", 89.99),
        ("50 mg", 109.99),
        ("60 mg", 129.99),
    ],
    "kpv": [
        ("10 mg", 39.99),
    ],
    "glow-blend": [
        ("70 mg", 69.99),
    ],
}


def get_product(slug):
    r = requests.get(
        f"{STRAPI_URL}/api/products",
        headers=HEAD,
        params={"filters[slug][$eq]": slug, "populate[variants]": "true"},
        timeout=90,
    )
    r.raise_for_status()
    data = r.json()["data"]
    return data[0] if data else None


def show(variants):
    if not variants:
        return "(aucun format)"
    return " | ".join(f"{v['label']} = {v['price']}" for v in variants)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not STRAPI_TOKEN:
        sys.exit("STRAPI_TOKEN manquant (voir les étapes dans la conversation).")

    print(f"Cible : {STRAPI_URL}\n")
    missing = []

    for slug, variants in PRICES.items():
        product = get_product(slug)
        if not product:
            missing.append(slug)
            print(f"[introuvable] {slug}\n")
            continue

        new = [{"label": label, "price": price} for label, price in variants]
        print(f"{slug}")
        print(f"  avant : {show(product.get('variants'))}")
        print(f"  après : {show(new)}\n")

        if args.dry_run:
            continue

        r = requests.put(
            f"{STRAPI_URL}/api/products/{product['documentId']}",
            headers=HEAD,
            json={"data": {"variants": new}},
            timeout=90,
        )
        r.raise_for_status()

    if missing:
        print("Produits à créer ou à corriger avant de relancer :", ", ".join(missing))
    if args.dry_run:
        print("\n(simulation : rien n'a été modifié)")


if __name__ == "__main__":
    main()