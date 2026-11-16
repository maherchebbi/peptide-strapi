/**
 * Exporte le contenu actuel de la base locale vers un seed portable :
 *   seed/data.json   -> catégories, produits (tous composants), commandes, messages,
 *                       newsletter, protocoles
 *   seed/uploads/    -> uniquement les images réellement utilisées (originaux)
 *
 * Le seed est ensuite importé automatiquement au démarrage de Strapi sur une base
 * vide (voir src/seed/import.ts), par exemple sur Easypanel.
 *
 * Usage (de préférence Strapi ARRÊTÉ) :
 *   node scripts/export-seed.js
 */
const fs = require('fs');
const path = require('path');
const { compileStrapi, createStrapi } = require('@strapi/strapi');

const ROOT = path.join(__dirname, '..');
const SEED_DIR = path.join(ROOT, 'seed');
const SEED_UPLOADS = path.join(SEED_DIR, 'uploads');

// Champs système à ne jamais exporter
const SYSTEM_FIELDS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'locale',
  'localizations',
  'createdBy',
  'updatedBy',
]);

// Collections "à plat" (sans média ni relation) exportées telles quelles
const FLAT_COLLECTIONS = {
  orders: 'api::order.order',
  contactMessages: 'api::contact-message.contact-message',
  newsletterSubscribers: 'api::newsletter-subscriber.newsletter-subscriber',
  protocols: 'api::protocol.protocol',
};

/** populate récursif de tous les composants et médias d'un modèle */
function buildPopulate(strapi, uid, { skipRelations = true } = {}) {
  const model = strapi.getModel(uid);
  const populate = {};
  for (const [name, attr] of Object.entries(model.attributes)) {
    if (attr.type === 'component') {
      const sub = buildPopulate(strapi, attr.component);
      populate[name] = Object.keys(sub).length ? { populate: sub } : true;
    } else if (attr.type === 'media') {
      populate[name] = true;
    } else if (attr.type === 'relation' && !skipRelations) {
      populate[name] = true;
    }
  }
  return populate;
}

async function main() {
  const appContext = await compileStrapi();
  const strapi = await createStrapi(appContext).load();
  strapi.log.level = 'error';

  const files = new Map(); // id -> manifest entry
  const usedNames = new Set();

  /** Remplace un média par une référence { __media: key } et copie le fichier */
  function registerMedia(file) {
    if (!file) return null;
    if (!files.has(file.id)) {
      if (file.provider !== 'local' || !file.url.startsWith('/')) {
        throw new Error(`Média non local (${file.provider}) : ${file.url}`);
      }
      const src = path.join(ROOT, 'public', file.url);
      if (!fs.existsSync(src)) throw new Error(`Fichier introuvable : ${src}`);

      const filename = `${file.hash}${file.ext}`;
      if (usedNames.has(filename)) throw new Error(`Nom en double : ${filename}`);
      usedNames.add(filename);
      fs.copyFileSync(src, path.join(SEED_UPLOADS, filename));

      files.set(file.id, {
        key: file.hash,
        file: filename,
        name: file.name,
        alternativeText: file.alternativeText ?? null,
        caption: file.caption ?? null,
        mime: file.mime,
      });
    }
    return { __media: files.get(file.id).key };
  }

  /** Nettoie récursivement une entrée selon son schéma */
  function clean(uid, entry) {
    const model = strapi.getModel(uid);
    const out = {};
    for (const [name, attr] of Object.entries(model.attributes)) {
      if (SYSTEM_FIELDS.has(name) || !(name in entry)) continue;
      const value = entry[name];
      if (attr.type === 'relation') continue; // gérées à part
      if (attr.type === 'component') {
        if (value == null) out[name] = attr.repeatable ? [] : null;
        else if (attr.repeatable) out[name] = value.map((v) => clean(attr.component, v));
        else out[name] = clean(attr.component, value);
      } else if (attr.type === 'media') {
        out[name] = attr.multiple ? (value || []).map(registerMedia) : registerMedia(value);
      } else {
        out[name] = value;
      }
    }
    return out;
  }

  fs.rmSync(SEED_DIR, { recursive: true, force: true });
  fs.mkdirSync(SEED_UPLOADS, { recursive: true });

  // Catégories (+ parent par slug)
  const categories = await strapi.documents('api::category.category').findMany({
    populate: { parent: { fields: ['slug'] } },
    sort: 'id:asc',
    limit: -1,
  });
  const seedCategories = categories.map((c) => ({
    ...clean('api::category.category', c),
    parent: c.parent?.slug ?? null,
  }));

  // Produits (+ catégorie par slug, tous les composants et médias)
  const products = await strapi.documents('api::product.product').findMany({
    populate: { ...buildPopulate(strapi, 'api::product.product'), category: { fields: ['slug'] } },
    sort: 'id:asc',
    limit: -1,
  });
  const seedProducts = products.map((p) => ({
    ...clean('api::product.product', p),
    category: p.category?.slug ?? null,
  }));

  // Collections simples
  const flat = {};
  for (const [key, uid] of Object.entries(FLAT_COLLECTIONS)) {
    const rows = await strapi.documents(uid).findMany({ sort: 'id:asc', limit: -1 });
    flat[key] = rows.map((r) => ({ ...clean(uid, r), createdAt: r.createdAt }));
  }

  const data = {
    exportedAt: new Date().toISOString(),
    files: [...files.values()],
    categories: seedCategories,
    products: seedProducts,
    ...flat,
  };
  fs.writeFileSync(path.join(SEED_DIR, 'data.json'), JSON.stringify(data, null, 2));

  console.log('Seed exporté dans seed/ :');
  console.log(`  images          : ${data.files.length}`);
  console.log(`  catégories      : ${data.categories.length}`);
  console.log(`  produits        : ${data.products.length}`);
  for (const key of Object.keys(FLAT_COLLECTIONS)) console.log(`  ${key.padEnd(16)}: ${data[key].length}`);

  await strapi.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
