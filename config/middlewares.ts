import type { Core } from '@strapi/strapi';

/**
 * En production, seule l'API Next intermédiaire doit pouvoir appeler Strapi
 * depuis un navigateur. STRAPI_CORS_ORIGIN liste les origines autorisées
 * (séparées par des virgules), ex: "https://www.mon-site.fr".
 * Sans cette variable en prod, CORS reste fermé par défaut (aucune origine).
 */
const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => {
  const isProd = env('NODE_ENV') === 'production';
  const origins = env.array('STRAPI_CORS_ORIGIN', []) as string[];

  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    {
      name: 'strapi::cors',
      config: {
        origin: isProd ? origins : origins.length ? origins : '*',
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};

export default config;
