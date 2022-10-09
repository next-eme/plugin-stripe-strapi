"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = [
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
