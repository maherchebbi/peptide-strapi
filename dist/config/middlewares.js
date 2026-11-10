"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * En production, seule l'API Next intermédiaire doit pouvoir appeler Strapi
 * depuis un navigateur. STRAPI_CORS_ORIGIN liste les origines autorisées
 * (séparées par des virgules), ex: "https://www.mon-site.fr".
 * Sans cette variable en prod, CORS reste fermé par défaut (aucune origine).
 */
const config = ({ env }) => {
    const isProd = env('NODE_ENV') === 'production';
    const origins = env.array('STRAPI_CORS_ORIGIN', []);
    return [
        'strapi::logger',
        'strapi::errors',
        {
            // Autorise les images et médias hébergés sur Cloudinary dans l'administration.
            name: 'strapi::security',
            config: {
                contentSecurityPolicy: {
                    useDefaults: true,
                    directives: {
                        'connect-src': ["'self'", 'https:'],
                        'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'res.cloudinary.com'],
                        'media-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', 'res.cloudinary.com'],
                        upgradeInsecureRequests: null,
                    },
                },
            },
        },
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
exports.default = config;
