"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const stripe_1 = __importDefault(require("stripe"));
const uuid_1 = require("uuid");
function calcPrice(price, tax = 14) {
    const finalTax = (+price * tax) / 100;
    return +Number(Number(price) + finalTax).toFixed(2);
}
exports.default = ({ strapi }) => {
    const stripeEnv = (key) => strapi.plugin('stripe').config(key);
    const stripe = new stripe_1.default(stripeEnv('secret'), { apiVersion: '2020-08-27' });
    return {
        // Generate Stripe Link
        async generateLink({ userId, items, tax }) {
            const itemsIds = items.map((it) => it.id);
            if (!userId || !itemsIds.length)
                return null;
            try {
                // Create invoice
                const invoice = await strapi.entityService.create('plugin::stripe.invoice', {
                    data: {
                        owner: userId,
                        notes: `BUY: ${itemsIds.join(', ')}`,
                        serial: (0, uuid_1.v4)(),
                        total: calcPrice(items.map((it) => it.net).reduce((a, b) => +a + +b), tax),
                    },
                });
                // Create stripe link
                const res = await stripe.checkout.sessions.create({
                    line_items: items.map((item) => ({
                        price_data: {
                            unit_amount: +Number(calcPrice(+item.net, tax) * 100).toFixed(2),
                            currency: 'usd',
                            product_data: {
                                name: item.title,
                            },
                        },
                        quantity: 1,
                    })),
                    metadata: { invoiceId: invoice.id, userId, items: itemsIds.join('@') },
                    mode: 'payment',
                    success_url: stripeEnv('success_url'),
                    cancel_url: stripeEnv('cancel_url'),
                });
                return (res === null || res === void 0 ? void 0 : res.url) || null;
            }
            catch (e) {
                console.log(e);
                return null;
            }
        },
        // Watch stripe events
        // Change invoice status
        // Callback ..
        async hook(signature, rawBody) {
            var _a;
            const secret = stripeEnv('hookSecret');
            let event;
            try {
                event = stripe.webhooks.constructEvent(rawBody, signature, secret);
            }
            catch (err) {
                console.error('stripe err', err);
            }
            // Handle the event
            const { invoiceId, userId, items } = event.data.object.metadata;
            const { email } = ((_a = event.data.object) === null || _a === void 0 ? void 0 : _a.customer_details) || {};
            switch (event.type) {
                case 'checkout.session.completed':
                    // Update Invoice
                    strapi.entityService.update('plugin::stripe.invoice', +invoiceId, { data: { email, publishedAt: new Date() } }).catch(() => {
                        console.log(`faild to update invoice ${invoiceId}, owner: ${userId}`);
                    });
                    // Insert Items in inventory
                    const invItems = items.split('@').map((inv) => ({
                        serial: (0, uuid_1.v4)(),
                        owner: +userId,
                        item: +inv,
                        publishedAt: new Date()
                    }));
                    for (const invItem of invItems) {
                        // Create invoice
                        strapi.entityService.create('api::inventory.inventory', { data: invItem }).catch((e) => {
                            console.log(`faild to create inventory ${invItem.item}, owner: ${userId}`);
                        });
                    }
                    break;
                case 'checkout.session.async_payment_failed':
                case 'charge.failed':
                case 'payment_intent.payment_failed':
                    // Update Invoice
                    invoiceId && strapi.entityService.update('plugin::stripe.invoice', invoiceId, { data: { email, failed: true, publishedAt: null } });
                    break;
                // ... handle other event types
                default:
                    if (process.env.NODE_ENV == 'development')
                        console.log(`Unhandled event type ${event.type}`);
            }
        }
    };
};
