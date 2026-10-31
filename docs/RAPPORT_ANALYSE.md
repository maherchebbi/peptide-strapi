# Rapport d'analyse — données produits RAL Pep → Peptide House

> Données **documentaires** issues du site source. Ce ne sont ni des recommandations médicales validées ni des instructions de traitement. Les droits de réutilisation des textes et images de la source doivent être vérifiés avant toute publication.

## 1. Chiffres clés

- Produits analysés : **30** / 30 (0 erreur d'extraction)
- Sections extraites : **787** (blocs typés : paragraphes, listes, cartes, définitions, liens)
- Section « Dosages & protocole » : **30**/30 · titration : **12** · reconstitution : **17** · application cutanée : 1 (SNAP-8)
- Couverture du bloc dosage : 100 % du texte rattaché à un champ (0 fragment non rattaché)
- Références externes : 87 · images de fiche : 28 (2 produits sans image sur la fiche)
- Boutique source : 47 variantes (prix du fournisseur, référence uniquement), 30/30 produits rattachés par slug↔SKU officiel

## 2. Qualité des données et problèmes

| Constat | Détail |
|---|---|
| Prix, variantes, mis en avant | Absents des fiches ; présents dans la boutique publique (API). **Vos prix/variantes/featured ne sont jamais écrasés** ; ceux de la source sont isolés dans `sourceInfo.supplierVariants`. « Best-seller » n'est pas « mis en avant » : décision à prendre. |
| Stock | Stock du fournisseur : non importé. |
| Catégories | La source a deux systèmes (éditorial : 16 valeurs, boutique : 10) ; **vos 9 catégories** sont utilisées. |
| Images | Inventaire d'URL uniquement, aucun téléchargement. Pas d'image de fiche pour `igf-1lr3-0-1mg` et `mots-c-10mg-double-chambre` (la boutique a une photo pour IG-01). |
| Libellé de conservation | 1 ligne par produit sans libellé dans la source (« Ne pas congeler… ») : label par défaut « Note ». |
| Texte long | 1 valeur > 255 caractères dans un champ `string` existant (`chemistry`, brénipatide) : sans effet en SQLite. |
| Doublon | Descriptions identiques : `mots-c` et `mots-c-10mg-double-chambre`. |
| Textes génériques | Les 3 libellés de dosage (Débutant / Usage courant / Élevé) et la note de titration sont identiques sur tous les produits concernés (texte du site, pas spécifique au produit). |
| SKU non rattachés | 34 SKU du catalogue boutique sans slug officiel ; 17 ressemblent à l'un de nos produits (suggestions **non appliquées**). |

## 3. Incohérences détectées (signalées, jamais corrigées)

**Cycle annoncé ≠ somme des phases de titration**
- `bioglutide-na-931` — Cycle annonce 16 sem. mais la somme des durees de titration = 20 sem. (derniere phase ouverte)
- `cagrilintide-am833` — Cycle annonce 12 sem. mais la somme des durees de titration = 16 sem. (derniere phase ouverte)
- `nad-plus` — Cycle annonce 12 sem. mais la somme des durees de titration = 8 sem. (derniere phase ouverte)
- `semaglutide` — Cycle annonce 16 sem. mais la somme des durees de titration = 20 sem. (derniere phase ouverte)
- `semax` — Cycle annonce 8 sem. mais la somme des durees de titration = 4 sem.
- `tb-500` — Cycle annonce 6 sem. mais la somme des durees de titration = 14 sem.
- `tirzepatide` — Cycle annonce 12 sem. mais la somme des durees de titration = 16 sem.

**Valeur de phase ≠ fourchette du libellé**
- `nad-plus` — Etape 2 : valeur « 75 mg » differente de la fourchette du libelle « 50-100 mg » (le libelle original est conserve ; ne pas utiliser la valeur comme dose).
- `nad-plus` — Etape 3 : valeur « 125 mg » differente de la fourchette du libelle « 100-150 mg » (le libelle original est conserve ; ne pas utiliser la valeur comme dose).

**Cycle « 0 sem. » ambigu**
- `pt-141` — Cycle « 0 sem. » ambigu : valeur numerique laissee vide, texte conserve.

Autres points : Bioglutide et Sémaglutide ont la même titration (la source indique elle-même un alignement sur la classe GLP-1) ; périodes non numériques conservées en texte (« Mois 1 », « Démarrage », « Semaines 17+ » ouverte).

## 4. État « Dosages & protocole » par produit

| Produit source | Slug Strapi | Catégorie | Réf. | Cycle | Timing | Titration | Reconst. | Variantes boutique |
|---|---|---|---|---|---|---|---|---|
| bioglutide | bioglutide-na-931 | metabolisme-composition-corporelle | 3 | 16 sem. | oui | 5 | — | 1 |
| bpc-157 | bpc-157 | reparation-recuperation | 3 | 8 sem. + 4 pause | oui | — | oui | 1 |
| bpc157-tb500 | bpc-157-tb-500-blend | reparation-recuperation | 3 | 6 sem. + 4 pause | oui | — | oui | 1 |
| brenipatide | brenipatide-ly-3537031 | metabolisme-composition-corporelle | 3 | 16 sem. | oui | 4 | — | 1 |
| cagrilintide | cagrilintide-am833 | metabolisme-composition-corporelle | 3 | 12 sem. + 4 pause | oui | 4 | — | 1 |
| cjc-1295 | cjc-1295-sans-dac | reparation-recuperation | 3 | 12 sem. + 4 pause | oui | — | oui | 1 |
| cjc1295-ipamorelin | cjc-1295-ipamorelin-blend | reparation-recuperation | 3 | 12 sem. + 4 pause | oui | — | oui | 1 |
| dsip | dsip | sommeil-recuperation | 3 | 6 sem. + 3 pause | oui | — | oui | 1 |
| epitalon | epitalon | longevite-energie | 3 | 2 sem. + 16 pause | oui | — | oui | 1 |
| ghk-cu | ghk-cu | peau-esthetique | 3 | 4 sem. + 4 pause | oui | — | oui | 4 |
| glow | glow-blend | peau-esthetique | 3 | 8 sem. + 2 pause | oui | 4 | — | 2 |
| glutathione | glutathion | longevite-energie | 3 | 8 sem. + 4 pause | oui | — | oui | 1 |
| igf-1lr3-0-1mg | igf-1-lr3 | performance-vitalite | 3 | 4 sem. + 4 pause | oui | — | oui | 2 |
| ipamorelin | ipamorelin | reparation-recuperation | 3 | 12 sem. + 4 pause | oui | — | oui | 1 |
| klow | klow-blend | peau-esthetique | 3 | 8 sem. + 2 pause | oui | 4 | — | 1 |
| kpv | kpv | anti-inflammatoire-immunite | 3 | 12 sem. + 4 pause | oui | — | oui | 1 |
| mots-c-10mg-double-chambre | mots-c-10mg-double-chambre | metabolisme-composition-corporelle | 3 | 12 sem. + 4 pause | oui | — | oui | 1 |
| mots-c | mots-c | metabolisme-composition-corporelle | 3 | 12 sem. + 4 pause | oui | — | oui | 3 |
| mt-1 | mt-1 | peau-esthetique | 3 | 12 sem. + 6 pause | oui | — | oui | 1 |
| mt-2 | mt-2 | peau-esthetique | 3 | 3 sem. + 1 pause | oui | 2 | — | 1 |
| nad-plus | nad-plus | longevite-energie | 3 | 12 sem. | oui | 3 | — | 1 |
| pt-141 | pt-141 | sante-sexuelle | 3 | 0 sem. | oui | — | oui | 1 |
| retatrutide | retatrutide | metabolisme-composition-corporelle | 3 | 16 sem. | oui | 5 | — | 8 |
| selank | selank | cognition-neuro | 3 | 8 sem. + 4 pause | oui | — | oui | 1 |
| semaglutide | semaglutide | metabolisme-composition-corporelle | 3 | 16 sem. | oui | 5 | — | 1 |
| semax | semax | cognition-neuro | 3 | 8 sem. + 2 pause | oui | 2 | — | 1 |
| snap-8 | snap-8 | peau-esthetique | 3 | 12 sem. + 4 pause | oui | — | application | 1 |
| tb-500 | tb-500 | reparation-recuperation | 3 | 6 sem. + 4 pause | oui | 2 | — | 1 |
| tesamorelin | tesamoreline | metabolisme-composition-corporelle | 3 | 12 sem. | oui | — | oui | 3 |
| tirzepatide | tirzepatide | metabolisme-composition-corporelle | 3 | 12 sem. | oui | 4 | — | 2 |

## 5. Correspondance avec vos composants

| Section source | Champ Strapi |
|---|---|
| Bénéfices potentiels | `highlights` |
| Mécanisme d'action | `mechanism` |
| Repères historiques | `history` |
| Identité chimique (25 produits) | `chemistry` + `purityNote` |
| Conseils d'utilisation | `handling` |
| Contre-indications | `safety` |
| À savoir / effets à surveiller | `sideEffects` (nouveau) |
| Conservation | `storage` |
| Sources & références | `references` |
| Évolution dans le temps | `timeline` (nouveau) |
| Associations synergiques / Stacks | `synergies` / `stacks` (nouveaux, composant `highlight`) |
| Dosages & protocole | `dosage` (nouveau, composants dédiés) |
| Sections éditoriales sans champ dédié (58) | `extraSections` (nouveau) |
| Traçabilité, catégories/statuts source, repères clés, variantes fournisseur | `sourceInfo` (nouveau) |

`status` n'est pas rempli (votre vocabulaire diffère de celui de la source ; le statut source est dans `sourceInfo.sourceStage` / `sourceBadge`).
