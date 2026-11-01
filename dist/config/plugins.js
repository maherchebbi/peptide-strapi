"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const allowedMediaTypes = [
    'image/*',
    'video/*',
    'audio/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.*',
    'text/plain',
    'text/csv',
];
const deniedTypes = [
    'image/svg+xml',
    'application/vnd.microsoft.portable-executable',
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-dosexec',
    'application/x-sh',
    'text/x-shellscript',
    'application/x-mach-binary',
];
const config = ({ env }) => ({
    'users-permissions': {
        config: {
            jwtManagement: 'refresh',
            sessions: {
                httpOnly: true,
            },
            register: {
                // "username" est toujours envoyé par l'API Next (= l'email), mais plus
                // demandé à l'utilisateur. On autorise prénom/nom à l'inscription ;
                // les adresses se complètent ensuite depuis la page Compte.
                allowedFields: ['firstName', 'lastName'],
            },
        },
    },
    upload: {
        config: {
            security: {
                allowedTypes: allowedMediaTypes,
                deniedTypes,
            },
        },
    },
});
exports.default = config;
