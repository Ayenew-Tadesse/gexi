import { Routes, Route } from 'react-router';
import { useT } from '../../i18n/index.jsx';
import StaffLayout from '../../components/StaffLayout.jsx';
import Overview from './Overview.jsx';
import AdminOrders from './AdminOrders.jsx';
import AdminOrderDetail from './AdminOrderDetail.jsx';
import Users from './Users.jsx';
import { Agents, Vendors, AdminProducts } from './Catalog.jsx';
import Payouts from './Payouts.jsx';
import Refunds from './Refunds.jsx';
import Reports from './Reports.jsx';
import Settings from './Settings.jsx';
import SmsLog from './SmsLog.jsx';

export default function AdminArea() {
  const { t } = useT();
  const links = [
    { to: '/admin', label: t('admin.nav.overview'), end: true },
    { to: '/admin/orders', label: t('admin.nav.orders') },
    { to: '/admin/payouts', label: t('admin.nav.payouts') },
    { to: '/admin/refunds', label: t('admin.nav.refunds') },
    { to: '/admin/reports', label: t('admin.nav.reports') },
    { to: '/admin/users', label: t('admin.nav.users') },
    { to: '/admin/agents', label: t('admin.nav.agents') },
    { to: '/admin/vendors', label: t('admin.nav.vendors') },
    { to: '/admin/products', label: t('admin.nav.products') },
    { to: '/admin/settings', label: t('admin.nav.settings') },
    { to: '/admin/sms', label: t('admin.nav.sms') },
  ];
  return (
    <Routes>
      <Route element={<StaffLayout links={links} title={t('roles.admin')} />}>
        <Route index element={<Overview />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="users" element={<Users />} />
        <Route path="agents" element={<Agents />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="payouts" element={<Payouts />} />
        <Route path="refunds" element={<Refunds />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="sms" element={<SmsLog />} />
      </Route>
    </Routes>
  );
}
