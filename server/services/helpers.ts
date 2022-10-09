import { Strapi } from '@strapi/strapi';
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';

function calcPrice(price: string | number, tax = 14) {
  const finalTax = (+price * tax) / 100;
  return +Number(Number(price) + finalTax).toFixed(2);
}

export default ({ strapi }: { strapi: Strapi }) => {
  const stripeEnv = (key: string) => strapi.plugin('stripe').config(key);
  const stripe = new Stripe(stripeEnv('secret'), { apiVersion: '2020-08-27' });

  return {
    // Generate Stripe Link
    async generateLink({ userId, items, tax }) {
      const itemsIds = items.map((it) => it.id);
      if (!userId || !itemsIds.length) return null;
      try {
        // Create invoice
        const invoice = await strapi.entityService.create('plugin::stripe.invoice', {
          data: {
            owner: userId,
            notes: `BUY: ${itemsIds.join(', ')}`,
            serial: uuidv4(),
            total: calcPrice(
              items.map((it) => it.net).reduce((a, b) => +a + +b),
              tax,
            ),
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
        return res?.url || null;
      } catch (e) {
        console.log(e);
        return null
      }
    },

    // Watch stripe events
    // Change invoice status
    // Callback ..
    async hook(signature: string, rawBody: any) {
      const secret = stripeEnv('hookSecret');
      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, secret);
      } catch (err) {
        console.error('stripe err', err)
      }

      // Handle the event
      const { invoiceId, userId, items } = event.data.object.metadata;
      const { email } = event.data.object?.customer_details || {};
      switch (event.type) {
        case 'checkout.session.completed':
          // Update Invoice
          strapi.entityService.update('plugin::stripe.invoice', +invoiceId, { data: { email, publishedAt: new Date() } }).catch(() => {
            console.log(`faild to update invoice ${invoiceId}, owner: ${userId}`);
          });
          // Insert Items in inventory
          const invItems = items.split('@').map((inv) => ({
            serial: uuidv4(),
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
  }
}
