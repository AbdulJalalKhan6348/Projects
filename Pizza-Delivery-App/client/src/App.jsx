import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { api, formatDate, money } from './api.js';

const AuthContext = createContext(null);
const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('pizza_auth_user') || 'null'); }
    catch { return null; }
  });
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem('pizza_auth_token')));

  useEffect(() => {
    const token = sessionStorage.getItem('pizza_auth_token');
    if (!token) { setLoading(false); return; }
    api('/auth/me')
      .then(data => {
        setUser(data.user);
        sessionStorage.setItem('pizza_auth_user', JSON.stringify(data.user));
      })
      .catch(() => {
        sessionStorage.removeItem('pizza_auth_token');
        sessionStorage.removeItem('pizza_auth_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (data) => {
    sessionStorage.setItem('pizza_auth_token', data.token);
    sessionStorage.setItem('pizza_auth_user', JSON.stringify(data.user));
    setUser(data.user);
  };

  const logout = () => {
    sessionStorage.removeItem('pizza_auth_token');
    sessionStorage.removeItem('pizza_auth_user');
    sessionStorage.removeItem('pizza_pizza_draft');
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Protected({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageMessage text="Checking your session…" />;
  if (!user) return <Navigate to={role === 'admin' ? '/admin/login' : '/login'} replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
}

function FullPageMessage({ text }) {
  return <main className="center-page"><div className="spinner" /><p>{text}</p></main>;
}

function Message({ children, type = 'info' }) {
  if (!children) return null;
  return <div className={`notice ${type}`} role="status">{children}</div>;
}

function AuthShell({ icon = '🍕', title, subtitle, children, footer }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link className="brand brand-center" to="/login"><span className="brand-mark">{icon}</span> Pizza House</Link>
        <h1>{title}</h1>
        <p className="muted auth-subtitle">{subtitle}</p>
        {children}
        <div className="auth-footer">{footer}</div>
      </section>
    </main>
  );
}

function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const [devLink, setDevLink] = useState('');
  const [busy, setBusy] = useState(false);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setMessage(''); setDevLink(''); setBusy(true);
    try {
      const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      setMessage(data.message); setDevLink(data.devVerificationUrl || '');
      setForm({ name: '', email: '', password: '' });
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return (
    <AuthShell title="Create your account" subtitle="Join Pizza House and build your own pizza." footer={<>Already have an account? <Link to="/login">Sign in</Link></>}>
      <form className="form-stack" onSubmit={submit}>
        <label>Full name<input name="name" value={form.name} onChange={update} minLength="2" maxLength="80" required placeholder="Your name" /></label>
        <label>Email address<input name="email" type="email" value={form.email} onChange={update} required placeholder="you@example.com" /></label>
        <label>Password<input name="password" type="password" value={form.password} onChange={update} minLength="8" required placeholder="At least 8 characters and 1 number" /><small>Use at least 8 characters and include a number.</small></label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <Message type="info">{message}</Message>
      {devLink && <p className="dev-link">Development verification link: <a href={devLink}>Verify email</a></p>}
    </AuthShell>
  );
}

function LoginPage({ admin = false }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const submit = async (e) => {
    e.preventDefault(); setMessage(''); setBusy(true);
    try {
      const data = await api(admin ? '/auth/admin/login' : '/auth/login', {
        method: 'POST', body: JSON.stringify({ identifier: email, password })
      });
      login(data);
      navigate(admin ? '/admin' : (location.state?.from || '/'), { replace: true });
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  return (
    <AuthShell icon={admin ? '🛠️' : '🍕'} title={admin ? 'Admin sign in' : 'Welcome back'} subtitle={admin ? 'Use the separately configured administrator account.' : 'Sign in to customise and track your pizza order.'} footer={admin ? <>Customer? <Link to="/login">Customer login</Link></> : <>New to Pizza House? <Link to="/register">Create an account</Link></>}>
      <form className="form-stack" onSubmit={submit}>
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required placeholder="you@example.com" /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required placeholder="Your password" /></label>
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : admin ? 'Admin sign in' : 'Sign in'}</button>
      </form>
      <Message type="error">{message}</Message>
      {!admin && <div className="auth-extra"><Link to="/forgot-password">Forgot password?</Link><Link to="/admin/login">Admin login</Link></div>}
    </AuthShell>
  );
}

function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [message, setMessage] = useState('Verifying your email…');
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const token = params.get('token');
    if (!token) { setMessage('Verification token is missing.'); return; }
    api(`/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(data => { setMessage(data.message); setOk(true); })
      .catch(error => setMessage(error.message));
  }, [params]);
  return <AuthShell title="Email verification" subtitle="Confirm your account email address." footer={<Link to="/login">Go to login</Link>}><Message type={ok ? 'success' : 'info'}>{message}</Message></AuthShell>;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devLink, setDevLink] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setMessage(''); setDevLink('');
    try { const data = await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); setMessage(data.message); setDevLink(data.devResetUrl || ''); }
    catch (error) { setMessage(error.message); }
  };
  return <AuthShell title="Reset your password" subtitle="We’ll send a reset link if the account exists." footer={<Link to="/login">Back to login</Link>}>
    <form className="form-stack" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" /></label><button className="btn btn-primary">Send reset link</button></form>
    <Message>{message}</Message>{devLink && <p className="dev-link"><a href={devLink}>Open development reset link</a></p>}
  </AuthShell>;
}

function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    try { const data = await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: params.get('token'), password }) }); setMessage(data.message); setDone(true); }
    catch (error) { setMessage(error.message); }
  };
  return <AuthShell title="Choose a new password" subtitle="Use at least 8 characters and one number." footer={<Link to="/login">Back to login</Link>}>
    {!done && <form className="form-stack" onSubmit={submit}><label>New password<input type="password" minLength="8" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="btn btn-primary">Update password</button></form>}
    <Message type={done ? 'success' : 'error'}>{message}</Message>
  </AuthShell>;
}

function AppHeader({ admin = false }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const leave = () => { logout(); navigate(admin ? '/admin/login' : '/login', { replace: true }); };
  return <header className="topbar"><Link to={admin ? '/admin' : '/'} className="brand"><span className="brand-mark">🍕</span> Pizza House</Link><div className="topbar-right"><span className="user-chip">{admin ? 'Admin' : `Hi, ${user?.name || 'there'}`}</span><button className="btn btn-ghost btn-small" onClick={leave}>Log out</button></div></header>;
}

const menuPizzas = [
  { name: 'Margherita', detail: 'Tomato, mozzarella & basil', emoji: '🍅' },
  { name: 'Garden Supreme', detail: 'A colourful vegetable mix', emoji: '🫑' },
  { name: 'BBQ Veggie', detail: 'Smoky BBQ sauce & vegetables', emoji: '🍄' },
  { name: 'Four Cheese', detail: 'A creamy cheese blend', emoji: '🧀' }
];
const steps = ['Choose a base', 'Choose a sauce', 'Choose cheese', 'Add vegetables'];

function OrderStatus({ status }) {
  const stages = ['order_received', 'in_kitchen', 'sent_to_delivery'];
  const current = stages.indexOf(status);
  const labels = ['Order received', 'In kitchen', 'Sent to delivery'];
  return <div className="progress-track">{labels.map((label, index) => <div key={label} className={`progress-step ${current >= index ? 'active' : ''}`}><span className="progress-dot">{current > index ? '✓' : index + 1}</span><span>{label}</span></div>)}</div>;
}

function CustomerDashboard() {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState({ base: [], sauce: [], cheese: [], vegetable: [] });
  const [orders, setOrders] = useState([]);
  const [catalogError, setCatalogError] = useState('');
  const [step, setStep] = useState(0);
  const [selection, setSelection] = useState({ base: '', sauce: '', cheese: '', vegetables: [] });
  const navigate = useNavigate();

  const refreshOrders = async () => {
    try { const data = await api('/orders/mine'); setOrders(data.orders); } catch { /* session guard handles expired sessions */ }
  };
  useEffect(() => {
    let live = true;
    api('/orders/catalog').then(data => { if (live) setCatalog(data.ingredients); }).catch(error => setCatalogError(error.message));
    refreshOrders();
    const timer = setInterval(refreshOrders, 8000);
    return () => { live = false; clearInterval(timer); };
  }, []);

  const selectedItems = useMemo(() => {
    const all = [...catalog.base, ...catalog.sauce, ...catalog.cheese, ...catalog.vegetable];
    return all.filter(item => [selection.base, selection.sauce, selection.cheese, ...selection.vegetables].includes(String(item.id)));
  }, [catalog, selection]);
  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.pricePaise, 0);

  const chooseSingle = (key, id) => setSelection(prev => ({ ...prev, [key]: String(id) }));
  const toggleVegetable = (id) => setSelection(prev => ({ ...prev, vegetables: prev.vegetables.includes(String(id)) ? prev.vegetables.filter(item => item !== String(id)) : [...prev.vegetables, String(id)] }));
  const canContinue = step === 0 ? Boolean(selection.base) : step === 1 ? Boolean(selection.sauce) : step === 2 ? Boolean(selection.cheese) : true;
  const review = () => {
    const chosen = {
      base: catalog.base.find(x => String(x.id) === selection.base),
      sauce: catalog.sauce.find(x => String(x.id) === selection.sauce),
      cheese: catalog.cheese.find(x => String(x.id) === selection.cheese),
      vegetables: catalog.vegetable.filter(x => selection.vegetables.includes(String(x.id)))
    };
    if (!chosen.base || !chosen.sauce || !chosen.cheese) return;
    sessionStorage.setItem('pizza_pizza_draft', JSON.stringify({ ...chosen, totalPaise: selectedTotal }));
    navigate('/checkout');
  };

  const renderChoice = (category, multiple = false) => {
    const items = catalog[category] || [];
    if (!items.length) return <p className="muted">No available items in this category.</p>;
    return <div className="choice-grid">{items.map(item => {
      const selected = multiple ? selection.vegetables.includes(String(item.id)) : selection[category] === String(item.id);
      return <button type="button" key={item.id} disabled={item.stock < 1} onClick={() => multiple ? toggleVegetable(item.id) : chooseSingle(category, item.id)} className={`choice-card ${selected ? 'selected' : ''}`}>
        <span className="choice-check">{selected ? '✓' : '+'}</span><strong>{item.name}</strong><span>{money(item.pricePaise)}</span><small>{item.stock > 0 ? `${item.stock} available` : 'Out of stock'}</small>
      </button>;
    })}</div>;
  };

  return <div className="app-shell"><AppHeader /><main className="page-wrap">
    <section className="welcome-banner"><div><p className="eyebrow">FRESH FROM OUR KITCHEN</p><h1>Build a pizza that’s <em>yours.</em></h1><p>Choose your favourite ingredients, review your order, and pay securely in test mode.</p></div><div className="hero-pizza">🍕</div></section>
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">CUSTOMER MENU</p><h2>Popular pizza ideas</h2></div></div><div className="menu-grid">{menuPizzas.map(pizza => <article className="menu-card" key={pizza.name}><span className="menu-emoji">{pizza.emoji}</span><div><h3>{pizza.name}</h3><p>{pizza.detail}</p></div><span className="menu-tag">Build yours ↓</span></article>)}</div></section>
    <section className="section-block builder-section"><div className="section-title"><div><p className="eyebrow">YOUR CUSTOM PIZZA</p><h2>Pizza builder</h2></div><span className="muted">Step {step + 1} of 4</span></div>
      <div className="step-tabs">{steps.map((label, index) => <button type="button" key={label} onClick={() => index <= step ? setStep(index) : null} className={index === step ? 'current' : index < step ? 'passed' : ''}><span>{index < step ? '✓' : index + 1}</span>{label}</button>)}</div>
      <div className="builder-panel"><h3>{steps[step]}</h3><p className="muted">{step === 3 ? 'Select as many vegetables as you like. This step is optional.' : 'Select one option to continue.'}</p>
        {catalogError ? <Message type="error">{catalogError}</Message> : renderChoice(['base', 'sauce', 'cheese', 'vegetable'][step], step === 3)}
        <div className="builder-actions">{step > 0 && <button className="btn btn-outline" onClick={() => setStep(step - 1)}>Back</button>}<span className="builder-total">Current total: <strong>{money(selectedTotal)}</strong></span>{step < 3 ? <button className="btn btn-primary" disabled={!canContinue} onClick={() => setStep(step + 1)}>Continue</button> : <button className="btn btn-primary" disabled={!selection.base || !selection.sauce || !selection.cheese} onClick={review}>Review order</button>}</div>
      </div>
    </section>
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">ORDER UPDATES</p><h2>Your recent orders</h2></div><span className="live-label"><i /> Updates every 8 seconds</span></div>
      {orders.length === 0 ? <div className="empty-card">No orders yet. Build your first pizza above!</div> : <div className="orders-grid">{orders.map(order => <article className="order-card" key={order._id}><div className="order-head"><div><small>ORDER #{order._id.slice(-7).toUpperCase()}</small><h3>{money(order.totalPaise)}</h3></div><span className={`status-pill ${order.status}`}>{order.status.replaceAll('_', ' ')}</span></div><p className="muted order-date">{formatDate(order.createdAt)}</p><div className="ingredient-tags">{order.ingredients.map(item => <span key={`${order._id}-${item.inventoryId}`}>{item.name}</span>)}</div>{order.paymentStatus === 'paid' ? <OrderStatus status={order.status} /> : <p className="muted">Payment: {order.paymentStatus}</p>}</article>)}</div>}
    </section>
  </main></div>;
}

function CheckoutPage() {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { try { setDraft(JSON.parse(sessionStorage.getItem('pizza_pizza_draft') || 'null')); } catch { setDraft(null); } }, []);
  const ingredients = draft ? [draft.base, draft.sauce, draft.cheese, ...(draft.vegetables || [])].filter(Boolean) : [];
  const total = ingredients.reduce((sum, item) => sum + item.pricePaise, 0);

  const cancelPending = async (id) => {
    try { await api(`/orders/${id}/cancel`, { method: 'POST' }); } catch { /* order may already be cancelled or verified */ }
  };

  const pay = async () => {
    if (!draft || busy) return;
    setError(''); setBusy(true);
    let appOrderId;
    try {
      const created = await api('/orders', {
        method: 'POST',
        body: JSON.stringify({
          baseId: draft.base.id,
          sauceId: draft.sauce.id,
          cheeseId: draft.cheese.id,
          vegetableIds: (draft.vegetables || []).map(item => item.id)
        })
      });
      appOrderId = created.appOrderId;
      if (!window.Razorpay) throw new Error('Razorpay Checkout did not load. Check your internet connection and refresh.');
      const checkout = new window.Razorpay({
        key: created.keyId,
        amount: created.amount,
        currency: created.currency,
        name: 'Pizza House',
        description: created.description,
        order_id: created.razorpayOrderId,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#246347' },
        handler: async (response) => {
          try {
            await api(`/orders/${appOrderId}/verify-payment`, { method: 'POST', body: JSON.stringify(response) });
            sessionStorage.removeItem('pizza_pizza_draft');
            navigate('/', { replace: true });
          } catch (verifyError) {
            setError(`Payment was received by Checkout but server verification needs attention: ${verifyError.message}. Contact the store and quote order ${appOrderId}.`);
            setBusy(false);
          }
        },
        modal: { ondismiss: async () => { await cancelPending(appOrderId); setBusy(false); } }
      });
      checkout.on('payment.failed', async () => { await cancelPending(appOrderId); setError('Payment did not complete. Your reserved stock has been released.'); setBusy(false); });
      checkout.open();
      setBusy(false);
    } catch (err) {
      if (appOrderId) await cancelPending(appOrderId);
      setError(err.message);
      setBusy(false);
    }
  };

  if (!draft) return <div className="app-shell"><AppHeader /><main className="page-wrap narrow"><div className="empty-card"><h2>No pizza to review</h2><p>Build your pizza first, then return to checkout.</p><Link className="btn btn-primary inline-btn" to="/">Back to menu</Link></div></main></div>;
  return <div className="app-shell"><AppHeader /><main className="page-wrap narrow"><div className="section-title"><div><p className="eyebrow">BEFORE PAYMENT</p><h1>Order summary</h1></div><Link to="/" className="text-link">← Edit pizza</Link></div>
    <section className="summary-card"><div className="summary-pizza-icon">🍕</div><h2>Your custom pizza</h2><p className="muted">Check your ingredients and total before opening Razorpay Checkout.</p><div className="summary-lines">{ingredients.map((item, index) => <div className="summary-line" key={`${item.id}-${index}`}><span>{item.category}: {item.name}</span><strong>{money(item.pricePaise)}</strong></div>)}<div className="summary-total"><span>Total</span><strong>{money(total)}</strong></div></div><Message type="error">{error}</Message><button className="btn btn-primary full-btn" disabled={busy} onClick={pay}>{busy ? 'Opening secure checkout…' : `Pay ${money(total)} with Razorpay`}</button><p className="fine-print">Test mode only. No live payment is collected by this demo.</p></section>
  </main></div>;
}

function AdminDashboard() {
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [stockDrafts, setStockDrafts] = useState({});
  const [busyId, setBusyId] = useState('');

  const refresh = async () => {
    try {
      const [stockData, orderData] = await Promise.all([api('/admin/inventory'), api('/admin/orders')]);
      setInventory(stockData.items);
      setOrders(orderData.orders);
      setError('');
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { refresh(); const timer = setInterval(refresh, 8000); return () => clearInterval(timer); }, []);

  const updateStock = async (item) => {
    const values = stockDrafts[item._id] || { stock: item.stock, threshold: item.lowStockThreshold };
    setBusyId(item._id); setError('');
    try {
      await api(`/admin/inventory/${item._id}`, { method: 'PATCH', body: JSON.stringify({ stock: Number(values.stock), lowStockThreshold: Number(values.threshold) }) });
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusyId(''); }
  };

  const updateStatus = async (orderId, status) => {
    setBusyId(orderId); setError('');
    try { await api(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh(); }
    catch (err) { setError(err.message); }
    finally { setBusyId(''); }
  };

  const groupedInventory = ['base', 'sauce', 'cheese', 'vegetable'];
  return <div className="app-shell"><AppHeader admin /><main className="page-wrap">
    <section className="welcome-banner admin-banner"><div><p className="eyebrow">STORE CONTROL CENTRE</p><h1>Admin <em>dashboard.</em></h1><p>Monitor ingredients, update stock, and move paid orders through the kitchen.</p></div><div className="hero-pizza">⚙️</div></section>
    <Message type="error">{error}</Message>
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">STOCK CONTROL</p><h2>Inventory</h2></div><span className="muted">{inventory.length} ingredients</span></div>
      {groupedInventory.map(category => <div className="inventory-group" key={category}><h3>{category[0].toUpperCase() + category.slice(1)}s</h3><div className="inventory-grid">{inventory.filter(item => item.category === category).map(item => {
        const draft = stockDrafts[item._id] || { stock: item.stock, threshold: item.lowStockThreshold };
        const low = item.stock < item.lowStockThreshold;
        return <article className={`inventory-card ${low ? 'low-stock' : ''}`} key={item._id}><div className="inventory-head"><strong>{item.name}</strong><span className={low ? 'low-label' : 'ok-label'}>{low ? 'Low stock' : 'In stock'}</span></div><div className="inventory-fields"><label>Units<input type="number" min="0" step="1" value={draft.stock} onChange={e => setStockDrafts(prev => ({ ...prev, [item._id]: { ...draft, stock: e.target.value } }))} /></label><label>Alert below<input type="number" min="0" step="1" value={draft.threshold} onChange={e => setStockDrafts(prev => ({ ...prev, [item._id]: { ...draft, threshold: e.target.value } }))} /></label></div><div className="inventory-foot"><small>{money(item.pricePaise)} per unit</small><button className="btn btn-outline btn-small" disabled={busyId === item._id} onClick={() => updateStock(item)}>{busyId === item._id ? 'Saving…' : 'Save stock'}</button></div></article>;
      })}</div></div>)}
    </section>
    <section className="section-block"><div className="section-title"><div><p className="eyebrow">KITCHEN QUEUE</p><h2>Paid orders</h2></div><span className="live-label"><i /> Updates every 8 seconds</span></div>
      {orders.length === 0 ? <div className="empty-card">No paid orders yet.</div> : <div className="admin-orders">{orders.map(order => <article className="admin-order-card" key={order._id}><div className="order-head"><div><small>#{order._id.slice(-7).toUpperCase()} · {order.user?.name || 'Customer'}</small><h3>{money(order.totalPaise)}</h3><p className="muted">{order.user?.email} · {formatDate(order.createdAt)}</p></div><span className={`status-pill ${order.status}`}>{order.status.replaceAll('_', ' ')}</span></div><div className="ingredient-tags">{order.ingredients.map((item, index) => <span key={`${order._id}-${index}`}>{item.name}</span>)}</div><div className="admin-order-actions"><label>Update status<select value={order.status} disabled={busyId === order._id} onChange={e => updateStatus(order._id, e.target.value)}><option value="order_received">Order Received</option><option value="in_kitchen">In Kitchen</option><option value="sent_to_delivery">Sent to Delivery</option></select></label></div></article>)}</div>}
    </section>
  </main></div>;
}

export default function App() {
  return <AuthProvider><Routes>
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/admin/login" element={<LoginPage admin />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route path="/" element={<Protected role="user"><CustomerDashboard /></Protected>} />
    <Route path="/checkout" element={<Protected role="user"><CheckoutPage /></Protected>} />
    <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes></AuthProvider>;
}
