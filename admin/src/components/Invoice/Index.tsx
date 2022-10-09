import React from 'react'
import { Layout, BaseHeaderLayout } from '@strapi/design-system/Layout';

const Invoice = () => {
    return (
        <Layout>
            <BaseHeaderLayout title="Stripe" subtitle="Invoices" as="h2" />
        </Layout>
    )
}

export default Invoice