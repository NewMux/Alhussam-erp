import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext';
import { Customer, CartItem, ProductOrService, PaymentMethod, PaymentStatus, Sale } from '../../types';
import { POSReceiptModal } from './POSReceiptModal';
import {
  ShoppingCart,
  User,
  Plus,
  Minus,
  Search,
  CheckCircle,
  WifiOff,
  Tag,
  ArrowLeft,
} from 'lucide-react';

export const POS: React.FC = () => {
  const {
    products,
    customers,
    measurements,
    inventory,
    staff,
    createPOSSale,
    isSimulatedOffline,
  } = useERP();

  // Selected customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BenefitPay Card');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Paid');
  const [notes, setNotes] = useState('');

  // Mobile View Switcher ('catalog' | 'cart')
  const [mobileActiveView, setMobileActiveView] = useState<'catalog' | 'cart'>('catalog');

  // Item customization modal (for tailor & fabric assignment)
  const [customizingProduct, setCustomizingProduct] = useState<ProductOrService | null>(null);
  const [selectedTailorId, setSelectedTailorId] = useState('');
  const [selectedFabricId, setSelectedFabricId] = useState('');

  // Receipt Modal State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Filter products by category
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const categories = ['All', 'Custom Tailoring', 'Fabric Roll', 'Alteration', 'Accessories'];

  const filteredProducts = products.filter((p) => {
    if (!p.active) return false;
    if (activeCategory === 'All') return true;
    return p.category === activeCategory;
  });

  // Handle adding product to cart
  const handleAddProduct = (prod: ProductOrService) => {
    if (prod.category === 'Custom Tailoring') {
      // Prompt modal for tailor and fabric roll selection
      setCustomizingProduct(prod);
      const tailors = staff.filter((s) => s.jobTitle.toLowerCase().includes('tailor'));
      setSelectedTailorId(tailors.length > 0 ? tailors[0].id : '');
      const fabrics = inventory.filter((i) => i.category === 'Fabric');
      setSelectedFabricId(fabrics.length > 0 ? fabrics[0].id : '');
    } else {
      addToCartDirect(prod);
    }
  };

  const addToCartDirect = (prod: ProductOrService, tailorId?: string, fabricId?: string) => {
    const existingIdx = cart.findIndex(
      (c) => c.productId === prod.id && c.assignedTailorId === tailorId && c.fabricId === fabricId
    );

    const tailorObj = staff.find((s) => s.id === tailorId);
    const fabricObj = inventory.find((i) => i.id === fabricId);
    const customerMeas = selectedCustomer ? measurements.find((m) => m.customerId === selectedCustomer.id) : undefined;

    if (existingIdx >= 0) {
      const updated = [...cart];
      updated[existingIdx].quantity += 1;
      updated[existingIdx].total = updated[existingIdx].quantity * updated[existingIdx].unitPrice;
      setCart(updated);
    } else {
      const newItem: CartItem = {
        productId: prod.id,
        name: prod.name,
        quantity: 1,
        unitPrice: prod.unitPrice,
        total: prod.unitPrice,
        measurementProfileId: customerMeas?.id,
        assignedTailorId: tailorId,
        assignedTailorName: tailorObj?.name,
        fabricId: fabricId,
        fabricName: fabricObj?.name,
        fabricMetersUsed: prod.defaultFabricMeters || 0,
      };
      setCart([...cart, newItem]);
    }
  };

  const handleConfirmCustomization = () => {
    if (!customizingProduct) return;
    addToCartDirect(customizingProduct, selectedTailorId, selectedFabricId);
    setCustomizingProduct(null);
  };

  const updateQuantity = (index: number, delta: number) => {
    const updated = [...cart];
    const newQty = updated[index].quantity + delta;
    if (newQty <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].quantity = newQty;
      updated[index].total = newQty * updated[index].unitPrice;
    }
    setCart(updated);
  };

  const subtotal = cart.reduce((acc, curr) => acc + curr.total, 0);
  const total = Math.max(0, subtotal - discount);

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Please add items to cart before completing checkout.');
      return;
    }

    const customerName = selectedCustomer ? selectedCustomer.name : 'Walk-in Customer';
    const customerPhone = selectedCustomer ? selectedCustomer.phone : '+973 ---- ----';

    const { sale } = createPOSSale(
      { id: selectedCustomer?.id, name: customerName, phone: customerPhone },
      cart,
      subtotal,
      discount,
      total,
      paymentMethod,
      paymentStatus,
      notes
    );

    setCompletedSale(sale);
    // Reset Cart
    setCart([]);
    setDiscount(0);
    setNotes('');
    setMobileActiveView('catalog');
  };

  const filteredCustomersModal = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      c.phone.includes(customerSearchQuery)
  );

  return (
    <div className="pos-mobile-container" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1.25rem', height: 'calc(100vh - 120px)' }}>
      {/* Mobile Top View Switcher */}
      <div className="mobile-only" style={{ gap: '0.5rem', marginBottom: '0.5rem' }}>
        <button
          className={`btn btn-sm ${mobileActiveView === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setMobileActiveView('catalog')}
        >
          Product Catalog
        </button>
        <button
          className={`btn btn-sm ${mobileActiveView === 'cart' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1 }}
          onClick={() => setMobileActiveView('cart')}
        >
          Cart ({cart.length}) • BHD {total.toFixed(3)}
        </button>
      </div>

      {/* LEFT PANEL: Catalog Selector (Visible on Desktop OR Mobile Catalog View) */}
      <div style={{ display: mobileActiveView === 'catalog' ? 'flex' : 'none', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
        {/* Customer Banner in POS */}
        <div className="card" style={{ padding: '0.85rem 1.25rem', background: '#ffffff' }}>
          <div className="flex-between">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: selectedCustomer ? 'var(--apple-blue-subtle)' : '#f2f2f7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedCustomer ? 'var(--apple-blue)' : 'var(--text-muted)' }}>
                <User size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {selectedCustomer ? selectedCustomer.name : 'Walk-in Customer'}
                </div>
                <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                  {selectedCustomer ? `${selectedCustomer.phone}` : 'No customer linked'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {selectedCustomer && (
                <button className="btn btn-sm btn-secondary" onClick={() => setSelectedCustomer(null)}>
                  Clear
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={() => setIsCustomerModalOpen(true)}>
                <Search size={14} /> Customer
              </button>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${activeCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveCategory(cat)}
              style={{ whiteSpace: 'nowrap' }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Cards Grid */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.85rem', paddingRight: '0.25rem' }}>
          {filteredProducts.map((prod) => (
            <div
              key={prod.id}
              className="card"
              style={{
                padding: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
                background: '#ffffff',
              }}
              onClick={() => handleAddProduct(prod)}
            >
              <div>
                <span className="badge badge-blue" style={{ fontSize: '0.65rem', marginBottom: '0.4rem' }}>
                  {prod.category}
                </span>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  {prod.name}
                </h4>
                {prod.defaultFabricMeters && prod.defaultFabricMeters > 0 ? (
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Est. Fabric: {prod.defaultFabricMeters}m
                  </span>
                ) : null}
              </div>

              <div className="flex-between" style={{ marginTop: '0.75rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--apple-blue)' }}>
                  BHD {prod.unitPrice.toFixed(3)}
                </span>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--apple-blue-subtle)', color: 'var(--apple-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={14} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile Bottom Bar for Cart Shortcut */}
        {cart.length > 0 && (
          <div className="mobile-only" style={{ marginTop: '0.5rem' }}>
            <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem' }} onClick={() => setMobileActiveView('cart')}>
              View Checkout Cart ({cart.length} items) • BHD {total.toFixed(3)}
            </button>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: POS Checkout Cart (Visible on Desktop OR Mobile Cart View) */}
      <div className="card" style={{ display: mobileActiveView === 'cart' ? 'flex' : 'none', flexDirection: 'column', height: '100%', padding: '1.15rem', background: '#ffffff' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
            <button className="btn btn-sm btn-secondary mobile-only" onClick={() => setMobileActiveView('catalog')} style={{ padding: '0.2rem 0.4rem' }}>
              <ArrowLeft size={14} />
            </button>
            <ShoppingCart size={18} color="var(--apple-blue)" /> Cart ({cart.length})
          </h3>
          {isSimulatedOffline && (
            <span className="badge badge-gold">
              <WifiOff size={10} /> Offline Queue
            </span>
          )}
        </div>

        {/* Cart Items List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1rem' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem' }}>
              <ShoppingCart size={36} style={{ opacity: 0.2, marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem' }}>No items in cart. Select products to add.</p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div
                key={idx}
                style={{
                  background: '#f9f9fb',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  padding: '0.65rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ flex: 1, paddingRight: '0.4rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>{item.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    BHD {item.unitPrice.toFixed(3)}
                    {item.assignedTailorName && ` • Tailor: ${item.assignedTailorName}`}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#ffffff', padding: '0.15rem 0.3rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <button className="btn btn-sm btn-secondary" style={{ padding: '0.1rem 0.25rem', minHeight: 24 }} onClick={() => updateQuantity(idx, -1)}>
                      <Minus size={10} />
                    </button>
                    <span style={{ fontWeight: 600, fontSize: '0.8rem', width: '16px', textAlign: 'center' }}>{item.quantity}</span>
                    <button className="btn btn-sm btn-secondary" style={{ padding: '0.1rem 0.25rem', minHeight: 24 }} onClick={() => updateQuantity(idx, 1)}>
                      <Plus size={10} />
                    </button>
                  </div>

                  <span style={{ fontWeight: 700, fontSize: '0.85rem', minWidth: '60px', textAlign: 'right', color: 'var(--apple-blue)' }}>
                    BHD {item.total.toFixed(3)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Calculation & Payment controls */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
            <div className="flex-between" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Subtotal:</span>
              <span>BHD {subtotal.toFixed(3)}</span>
            </div>

            <div className="flex-between" style={{ alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Tag size={12} /> Discount:
              </span>
              <input
                type="number"
                step="0.500"
                min="0"
                className="input"
                style={{ width: '90px', textAlign: 'right', padding: '0.2rem 0.4rem', minHeight: 32 }}
                value={discount}
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="flex-between" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', paddingTop: '0.4rem', borderTop: '1px solid var(--border-color)' }}>
              <span>Total:</span>
              <span style={{ color: 'var(--apple-blue)' }}>BHD {total.toFixed(3)}</span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="form-group" style={{ marginBottom: '0.85rem' }}>
            <label className="form-label" style={{ fontSize: '0.75rem' }}>Payment Method</label>
            <div className="grid-2" style={{ gap: '0.35rem' }}>
              {(['BenefitPay Card', 'Cash', 'Bank Transfer', 'Credit Card'] as PaymentMethod[]).map((pm) => (
                <button
                  key={pm}
                  type="button"
                  className={`btn btn-sm ${paymentMethod === pm ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPaymentMethod(pm)}
                  style={{ fontSize: '0.75rem', padding: '0.3rem', minHeight: 32 }}
                >
                  {pm}
                </button>
              ))}
            </div>
          </div>

          {/* Checkout Button */}
          <button className="btn btn-primary" style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', fontWeight: 600 }} onClick={handleCheckout}>
            <CheckCircle size={18} /> Checkout & Receipt
          </button>
        </div>
      </div>

      {/* Customer Lookup Modal */}
      {isCustomerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3>Select Customer</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setIsCustomerModalOpen(false)}>
                Close
              </button>
            </div>

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input"
                  style={{ paddingLeft: '2.5rem' }}
                  placeholder="Search name or phone..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {filteredCustomersModal.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '0.75rem',
                    background: '#f9f9fb',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    setSelectedCustomer(c);
                    setIsCustomerModalOpen(false);
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.phone}</div>
                  </div>
                  <button className="btn btn-sm btn-primary">Select</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Tailoring Option Assignment Modal */}
      {customizingProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3>Assign Options ({customizingProduct.name})</h3>
              <button className="btn btn-sm btn-secondary" onClick={() => setCustomizingProduct(null)}>
                Cancel
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Tailor Specialist</label>
              <select
                className="select"
                value={selectedTailorId}
                onChange={(e) => setSelectedTailorId(e.target.value)}
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: '#ffffff', color: '#000000' }}>
                    {s.name} ({s.jobTitle})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Fabric Material</label>
              <select
                className="select"
                value={selectedFabricId}
                onChange={(e) => setSelectedFabricId(e.target.value)}
              >
                {inventory.filter((i) => i.category === 'Fabric').map((f) => (
                  <option key={f.id} value={f.id} style={{ background: '#ffffff', color: '#000000' }}>
                    {f.name} ({f.quantity} {f.unit})
                  </option>
                ))}
              </select>
            </div>

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleConfirmCustomization}>
              Add to POS Cart
            </button>
          </div>
        </div>
      )}

      {/* POS Receipt Modal */}
      {completedSale && (
        <POSReceiptModal sale={completedSale} onClose={() => setCompletedSale(null)} />
      )}
    </div>
  );
};
