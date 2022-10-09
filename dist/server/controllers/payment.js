"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ({ strapi }) => ({
    hook(ctx) {
        ctx.body = strapi
            .plugin('stripe')
            .service('helpers')
            .hook();
    },
});
