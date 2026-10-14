import { Routes, Route } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import StaffLayout from '../../components/StaffLayout.jsx';
import Dashboard from './Dashboard.jsx';
import Vendors from './Vendors.jsx';
import VendorForm from './VendorForm.jsx';
import Products from './Products.jsx';
import ProductForm from './ProductForm.jsx';
import AgentOrders from './AgentOrders.jsx';
import Earnings from './Earnings.jsx';

export default function AgentArea() {
  const { t } = useT();
  const links = [
    { to: '/agent', label: t('agent.nav.dashboard'), end: true },
    { to: '/agent/vendors', label: t('agent.nav.vendors') },
    { to: '/agent/products', label: t('agent.nav.products') },
    { to: '/agent/orders', label: t('agent.nav.orders') },
    { to: '/agent/earnings', label: t('agent.nav.earnings') },
  ];
  return (
    <Routes>
      <Route element={<StaffLayout links={links} title={t('roles.agent')} />}>
        <Route index element={<Dashboard />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="vendors/new" element={<VendorForm />} />
        <Route path="vendors/:id" element={<VendorForm />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="orders" element={<AgentOrders />} />
        <Route path="earnings" element={<Earnings />} />
      </Route>
    </Routes>
  );
}
