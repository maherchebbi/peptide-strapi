# Import « Dosages & protocole » + contenu documentaire dans Strapi 5.58

Données **documentaires** issues de RAL Pep (non validées médicalement, droits de réutilisation à vérifier).
Cet import ne touche jamais : `slug`, `name`, `description`, `short`, `image`, `price`, `variants`, `featured`.
Il **complète** les champs de contenu vides ; ce qui est déjà saisi n'est pas remplacé (sauf `--overwrite`).

## 0. Contenu du pack (à copier dans la racine de `peptide-strapi`)

- `src/api/product/content-types/product/schema.json` : schéma produit COMPLET (champs existants inchangés + 7 nouveaux champs facultatifs)
- `src/components/product/` : 9 nouveaux composants (dosage-section, dosage-reference, titration-phase, reconstitution, dosage-note, timeline-item, rich-section, supplier-variant, source-info)
- `scripts/import-products.js`, `scripts/lib/import-logic.js` (+ test), `scripts/data/products_normalized.json` (30 produits)
- `docs/RAPPORT_ANALYSE.md`

## 1. Préparer (Strapi doit être ARRÊTÉ : Ctrl+C dans le terminal de `npm run develop`)

```bash
cd <dossier peptide-strapi>
cp src/api/product/content-types/product/schema.json /tmp/schema.product.avant-import.json
cp .tmp/data.db .tmp/data.db.avant-import      # base SQLite par défaut ; sinon voir config/database.ts
unzip -o ~/Downloads/peptide-strapi-import.zip -d .
```

## 2. Laisser Strapi créer les nouvelles tables

```bash
npm run develop
```

Attendre le message « Server started » (aucune erreur rouge), puis arrêter avec Ctrl+C.

## 3. Tester la logique, puis SIMULER

```bash
node scripts/lib/import-logic.test.js      # doit afficher : OK : 7 verifications passees
node scripts/import-products.js            # SIMULATION : rien n'est écrit
```

Lire le résumé : `mis_a_jour` (à mettre à jour), `absents_de_strapi`, `erreurs`.
Si des produits sont `absent_de_strapi`, relancer avec `--seed chemin/vers/votre_fichier_seed.json`
(le fichier `{categories, products}` qui contient vos noms et descriptions) : ils seront créés avec VOS données.

## 4. Appliquer

```bash
node scripts/import-products.js --apply
```

Rapport détaillé : `scripts/data/import_report.json` (champs écrits / ignorés par produit, avertissements).
Le script est rejouable : un 2e passage ne change rien (pas de doublon).

## 5. Vérifier

```bash
npm run develop
```

Admin → Content Manager → Product → ouvrir `bioglutide-na-931` : le composant **Dosage** doit afficher 3 dosages de
référence et 5 étapes de titration ; `Source info` contient l'URL, la date et les mentions de droits.

## Options

| Option | Effet |
|---|---|
| `--only slug1,slug2` | limiter à certains produits (slugs Strapi) |
| `--overwrite` | remplacer aussi les champs de contenu déjà renseignés (à éviter sur brenipatide) |
| `--seed fichier.json` | créer les produits manquants |
| `--data fichier.json` | utiliser un autre JSON normalisé |

## Retour arrière

Arrêter Strapi, puis : `cp .tmp/data.db.avant-import .tmp/data.db` et
`cp /tmp/schema.product.avant-import.json src/api/product/content-types/product/schema.json`.

## Notes

- Images : aucune image n'est téléchargée ni importée (inventaire d'URL dans le JSON, droits à vérifier).
- Prix/stock du fournisseur : référence dans `sourceInfo.supplierVariants` uniquement (stock non importé).
- Le front Next.js doit demander les nouveaux champs (`populate`) pour les afficher ; le Protocol Builder n'est pas modifié.
