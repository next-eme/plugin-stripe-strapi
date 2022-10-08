"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const unparsed_js_1 = __importDefault(require("koa-body/unparsed.js"));
exports.default = ({ strapi }) => ({
    hook(ctx) {
        const sign = ctx.request.headers['stripe-signature'];
        return strapi
            .plugin('stripe')
            .service('helpers')
            .hook(sign, ctx.request.body[unparsed_js_1.default]);
    },
});
