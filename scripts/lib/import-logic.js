'use strict';
/**
 * Logique d'import SANS dependance a Strapi (testable avec un faux `strapi`).
 *
 * Regles :
 *  - Champs proteges (jamais ecrits sur un produit existant) : slug, name, description, short, image,
 *    price, variants, featured.
 *  - Par defaut un champ de contenu deja renseigne n'est PAS remplace (seulement complete).
 *  - Aucune creation de produit sans `seed` : on ne fabrique ni nom ni description.
 */

const PRODUCT_UID = 'api::product.product';
const CATEGORY_UID = 'api::category.category';

const PROTECTED = ['slug', 'name', 'description', 'short', 'image', 'price', 'variants', 'featured'];

const POPULATE = {
  category: true,
  facts: true, chemistry: true, highlights: true, mechanism: true, history: true, handling: true,
  storage: true, safety: true, references: true, timeline: true, synergies: true, stacks: true,
  sideEffects: true, extraSections: true,
  dosage: {
    populate: {
      referenceDosages: true, titrationPhases: true, reconstitution: true,
      relatedSections: true, notes: true, extraStats: true,
    },
  },
  sourceInfo: { populate: { keyFigures: true, supplierVariants: true } },
};

function isEmpty(v) {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).filter((k) => !['id', 'documentId'].includes(k)).length === 0;
  return false;
}

/** Calcule le patch a ecrire pour un produit existant. */
function computePatch(existing, data, { overwrite = false } = {}) {
  const patch = {};
  const written = [];
  const skipped = [];
  for (const [field, value] of Object.entries(data)) {
    if (PROTECTED.includes(field)) { skipped.push({ field, reason: 'champ protege' }); continue; }
    if (isEmpty(value)) continue;
    if (overwrite || isEmpty(existing[field])) {
      patch[field] = value;
      written.push(field);
    } else {
      skipped.push({ field, reason: 'deja renseigne (utiliser --overwrite pour remplacer)' });
    }
  }
  return { patch, written, skipped };
}

async function ensureCategories(strapi, categories, { apply }) {
  const map = {};
  const report = [];
  for (const c of categories) {
    let found = await strapi.documents(CATEGORY_UID).findFirst({ filters: { slug: c.slug } });
    if (found) {
      report.push({ slug: c.slug, status: 'existe' });
    } else if (apply) {
      found = await strapi.documents(CATEGORY_UID).create({ data: { slug: c.slug, label: c.label, icon: c.icon } });
      report.push({ slug: c.slug, status: 'cree' });
    } else {
      report.push({ slug: c.slug, status: 'a creer (simulation)' });
    }
    if (found) map[c.slug] = found.documentId;
  }
  return { map, report };
}

async function importProducts(strapi, payload, opts = {}) {
  const { apply = false, overwrite = false, only = null, seed = null, log = () => {} } = opts;
  const out = { mode: apply ? 'APPLY' : 'SIMULATION', startedAt: new Date().toISOString(), categories: [], products: [], totals: {} };

  const cats = await ensureCategories(strapi, payload.meta.categories, { apply });
  out.categories = cats.report;

  const seedBySlug = {};
  if (seed && Array.isArray(seed.products)) for (const p of seed.products) seedBySlug[p.slug] = p;

  for (const item of payload.products) {
    if (only && !only.includes(item.slug)) continue;
    const entry = { slug: item.slug, sourceSlug: item.sourceSlug, status: '', fieldsWritten: [], fieldsSkipped: [], warnings: item.warnings.slice(), error: null };
    try {
      const existing = await strapi.documents(PRODUCT_UID).findFirst({ filters: { slug: item.slug }, populate: POPULATE });
      if (existing) {
        const { patch, written, skipped } = computePatch(existing, item.data, { overwrite });
        const catDoc = cats.map[item.categorySlug];
        if (!existing.category && catDoc) { patch.category = { connect: [catDoc] }; written.push('category'); }
        entry.fieldsWritten = written;
        entry.fieldsSkipped = skipped;
        if (!written.length) entry.status = 'inchange';
        else if (apply) {
          await strapi.documents(PRODUCT_UID).update({ documentId: existing.documentId, data: patch });
          entry.status = 'mis_a_jour';
        } else entry.status = 'a_mettre_a_jour (simulation)';
      } else {
        const base = seedBySlug[item.slug];
        if (!base) {
          entry.status = 'absent_de_strapi';
          entry.warnings.push('Produit inexistant dans Strapi et aucun --seed fourni : non cree (ni nom ni description inventes).');
        } else {
          const data = { slug: base.slug, name: base.name, description: base.description };
          for (const f of ['short', 'price', 'featured', 'variants']) if (base[f] !== undefined) data[f] = base[f];
          Object.assign(data, item.data);
          const catDoc = cats.map[base.category || item.categorySlug];
          if (catDoc) data.category = { connect: [catDoc] };
          entry.fieldsWritten = Object.keys(data);
          if (apply) {
            await strapi.documents(PRODUCT_UID).create({ data });
            entry.status = 'cree';
          } else entry.status = 'a_creer (simulation)';
        }
      }
    } catch (e) {
      entry.status = 'erreur';
      entry.error = String(e && e.message ? e.message : e);
    }
    log(entry);
    out.products.push(entry);
  }

  const count = (s) => out.products.filter((p) => p.status.startsWith(s)).length;
  out.totals = {
    produits_dans_fichier: out.products.length,
    mis_a_jour: count('mis_a_jour') + count('a_mettre_a_jour'),
    crees: count('cree') + count('a_creer'),
    inchanges: count('inchange'),
    absents_de_strapi: count('absent'),
    erreurs: count('erreur'),
  };
  out.finishedAt = new Date().toISOString();
  return out;
}

module.exports = { importProducts, computePatch, isEmpty, ensureCategories, PROTECTED, POPULATE, PRODUCT_UID, CATEGORY_UID };
