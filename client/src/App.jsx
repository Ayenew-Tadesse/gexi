// All pages of the app. Browsing pages load immediately; everything else (and every staff area)
// is downloaded only when needed, so customers on slow connections get a small first download.
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router';
import CustomerLayout from './components/CustomerLayout.jsx';
import RequireRole from './components/RequireRole.jsx';
import { Spinner } from './components/ui.jsx';
import Home from './pages/customer/Home.jsx';
import Products from './pages/customer/Products.jsx';
import ProductDetail from './pages/customer/ProductDetail.jsx';

const Cart = lazy(() => import('./pages/customer/Cart.jsx'));
const Checkout = lazy(() => import('./pages/customer/Checkout.jsx'));
const PaymentReturn = lazy(() => import('./pages/customer/PaymentReturn.jsx'));
const Orders = lazy(() => import('./pages/customer/Orders.jsx'));
const OrderDetail = lazy(() => import('./pages/customer/OrderDetail.jsx'));
const Login = lazy(() => import('./pages/customer/Login.jsx'));
const Register = lazy(() => import('./pages/customer/Register.jsx'));
const Account = lazy(() => import('./pages/customer/Account.jsx'));
const PickupInfo = lazy(() => import('./pages/customer/PickupInfo.jsx'));
const MockPay = lazy(() => import('./pages/customer/MockPay.jsx'));
const AgentArea = lazy(() => import('./pages/agent/AgentArea.jsx'));
const WarehouseArea = lazy(() => import('./pages/staff/WarehouseArea.jsx'));
const PickupArea = lazy(() => import('./pages/staff/PickupArea.jsx'));
const AdminArea = lazy(() => import('./pages/admin/AdminArea.jsx'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <ScrollToTop />
      <Routes>
        <Route element={<CustomerLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<RequireRole><Checkout /></RequireRole>} />
          <Route path="checkout/return" element={<RequireRole><PaymentReturn /></RequireRole>} />
          <Route path="orders" element={<RequireRole><Orders /></RequireRole>} />
          <Route path="orders/:id" element={<RequireRole><OrderDetail /></RequireRole>} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="account" element={<RequireRole><Account /></RequireRole>} />
          <Route path="pickup-info" element={<PickupInfo />} />
          <Route path="dev/mock-pay" element={<MockPay />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="agent/*" element={<RequireRole roles={['agent']}><AgentArea /></RequireRole>} />
        <Route path="warehouse/*" element={<RequireRole roles={['warehouse']}><WarehouseArea /></RequireRole>} />
        <Route path="pickup/*" element={<RequireRole roles={['pickup']}><PickupArea /></RequireRole>} />
        <Route path="admin/*" element={<RequireRole roles={['admin']}><AdminArea /></RequireRole>} />
      </Routes>
    </Suspense>
  );
}

function NotFound() {
  return <div className="empty"><h1>404</h1><a href="/">Gexi</a></div>;
}
