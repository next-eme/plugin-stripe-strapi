import { Strapi } from '@strapi/strapi';
import unparsed from 'koa-body/unparsed.js'

export default ({ strapi }: { strapi: Strapi }) => ({
  hook(ctx) {
    const sign = ctx.request.headers['stripe-signature'] as string
    return strapi
      .plugin('stripe')
      .service('helpers')
      .hook(sign, ctx.request.body[unparsed]);
  },
});
