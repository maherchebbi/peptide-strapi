import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Core } from '@strapi/strapi';

/**
 * Import du seed généré par `node scripts/export-seed.js` (dossier seed/ à la
 * racine du projet). Exécuté au bootstrap :
 *  - catalogue (images + catégories + produits) : seulement si la base ne
 *    contient encore aucune catégorie ni aucun produit ;
 *  - commandes / messages / newsletter / protocoles : seulement si la
 *    collection correspondante est vide.
 * Rien n'est jamais écrasé. Désactivable avec SEED_DISABLED=true.
 *
 * SEED_RESET_CATALOG=true : supprime les catégories et produits existants
 * (ex. ancien catalogue de démo) puis réimporte le catalogue du seed.
 * À retirer après le déploiement, sinon le catalogue est réinitialisé à
 * chaque redémarrage.
 */

type SeedFile = {
  key: string;
  file: string;
  name: string;
  alternativeText: string | null;
  caption: string | null;
  mime: string;
};

type SeedData = {
  files: SeedFile[];
  categories: Array<Record<string, any> & { slug: string; parent: string | null }>;
  products: Array<Record<string, any> & { category: string | null }>;
  orders?: Array<Record<string, any>>;
  contactMessages?: Array<Record<string, any>>;
  newsletterSubscribers?: Array<Record<string, any>>;
  protocols?: Array<Record<string, any>>;
};

const FLAT_COLLECTIONS = {
  orders: 'api::order.order',
  contactMessages: 'api::contact-message.contact-message',
  newsletterSubscribers: 'api::newsletter-subscriber.newsletter-subscriber',
  protocols: 'api::protocol.protocol',
} as const;

export async function importSeed(strapi: Core.Strapi) {
  if (process.env.SEED_DISABLED === 'true') {
    strapi.log.info('[seed] Désactivé (SEED_DISABLED=true).');
    return;
  }

  const seedDir = path.join(strapi.dirs.app.root, 'seed');
  const dataPath = path.join(seedDir, 'data.json');
  if (!fs.existsSync(dataPath)) {
    strapi.log.warn(`[seed] Fichier introuvable : ${dataPath} — import ignoré.`);
    return;
  }
  strapi.log.info(`[seed] Seed trouvé : ${dataPath}`);

  const data: SeedData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  try {
    if (process.env.SEED_RESET_CATALOG === 'true') await resetCatalog(strapi);
    await importCatalog(strapi, data, seedDir);
    await importFlatCollections(strapi, data);
  } catch (err) {
    strapi.log.error(`[seed] Échec de l'import : ${(err as Error).stack ?? err}`);
  }
}

async function resetCatalog(strapi: Core.Strapi) {
  strapi.log.warn('[seed] SEED_RESET_CATALOG=true : suppression des produits et catégories existants…');
  for (const uid of ['api::product.product', 'api::category.category'] as const) {
    const docs = await strapi.documents(uid).findMany({ fields: ['documentId'] as any, limit: -1 });
    for (const doc of docs) await strapi.documents(uid).delete({ documentId: doc.documentId });
    strapi.log.warn(`[seed] ${docs.length} entrée(s) supprimée(s) dans ${uid}.`);
  }
}

async function importCatalog(strapi: Core.Strapi, data: SeedData, seedDir: string) {
  const [categoryCount, productCount] = await Promise.all([
    strapi.documents('api::category.category').count({}),
    strapi.documents('api::product.product').count({}),
  ]);
  if (categoryCount > 0 || productCount > 0) {
    strapi.log.info(
      `[seed] Catalogue ignoré : la base contient déjà ${categoryCount} catégorie(s) et ${productCount} produit(s). ` +
        'Pour le remplacer par le seed : SEED_RESET_CATALOG=true (une seule fois).'
    );
    return;
  }

  strapi.log.info(
    `[seed] Base vide : import de ${data.files.length} images, ${data.categories.length} catégories, ${data.products.length} produits…`
  );

  // 1) Images -> médiathèque (formats/miniatures régénérés par le plugin upload)
  const mediaIdByKey: Record<string, number> = {};
  const uploadService = strapi.plugin('upload').service('upload');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strapi-seed-'));
  try {
    for (const file of data.files) {
      const src = path.join(seedDir, 'uploads', file.file);
      if (!fs.existsSync(src)) {
        strapi.log.warn(`[seed] Image manquante, ignorée : ${file.file}`);
        continue;
      }
      // copie temporaire : le plugin upload ne doit pas toucher au seed
      const tmp = path.join(tmpDir, file.file);
      fs.copyFileSync(src, tmp);
      const [uploaded] = await uploadService.upload({
        data: {
          fileInfo: {
            name: file.name,
            alternativeText: file.alternativeText ?? undefined,
            caption: file.caption ?? undefined,
          },
        },
        files: {
          filepath: tmp,
          originalFilename: file.name,
          mimetype: file.mime,
          size: fs.statSync(tmp).size,
        },
      });
      mediaIdByKey[file.key] = uploaded.id;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const resolveMedia = (value: any): any => {
    if (Array.isArray(value)) return value.map(resolveMedia);
    if (value && typeof value === 'object') {
      if ('__media' in value) return mediaIdByKey[value.__media] ?? null;
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveMedia(v)]));
    }
    return value;
  };

  // 2) Catégories, puis rattachement des parents
  const categoryIdBySlug: Record<string, string> = {};
  for (const { parent, ...category } of data.categories) {
    const created = await strapi.documents('api::category.category').create({ data: category as any });
    categoryIdBySlug[category.slug] = created.documentId;
  }
  for (const { slug, parent } of data.categories) {
    if (parent && categoryIdBySlug[parent]) {
      await strapi.documents('api::category.category').update({
        documentId: categoryIdBySlug[slug],
        data: { parent: categoryIdBySlug[parent] } as any,
      });
    }
  }

  // 3) Produits
  for (const { category, ...product } of data.products) {
    const categoryId = category ? categoryIdBySlug[category] : undefined;
    await strapi.documents('api::product.product').create({
      data: { ...resolveMedia(product), ...(categoryId ? { category: categoryId } : {}) },
    });
  }

  strapi.log.info('[seed] Catalogue importé.');
}

async function importFlatCollections(strapi: Core.Strapi, data: SeedData) {
  for (const [key, uid] of Object.entries(FLAT_COLLECTIONS)) {
    const rows = data[key as keyof typeof FLAT_COLLECTIONS];
    if (!rows?.length) continue;
    const existing = await strapi.documents(uid).count({});
    if (existing > 0) {
      strapi.log.info(`[seed] ${uid} ignoré : ${existing} entrée(s) déjà présente(s).`);
      continue;
    }

    for (const { createdAt, ...row } of rows) {
      const created = await strapi.documents(uid).create({ data: row as any });
      // conserve la date d'origine (commandes, messages…)
      if (createdAt) {
        await strapi.db.query(uid).update({ where: { id: created.id }, data: { createdAt } });
      }
    }
    strapi.log.info(`[seed] ${rows.length} entrée(s) importée(s) dans ${uid}.`);
  }
}
