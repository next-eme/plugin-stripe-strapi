export default [
  {
    method: 'POST',
    path: '/web-hook',
    handler: 'webhook.hook',
    config: {
      policies: [],
      auth: false,
    },
  },
];
