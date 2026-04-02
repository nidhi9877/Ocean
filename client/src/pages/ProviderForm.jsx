import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';

const API = '/api';

const CATEGORIES = [
  'Engine Parts',
  'Propulsion Systems',
  'Navigation Equipment',
  'Deck Hardware',
  'Electrical Systems',
  'Pumps & Plumbing',
  'Safety Equipment',
  'Hull & Structural',
  'HVAC Systems',
  'Communication Equipment',
  'Winches & Cranes',
  'Valves & Fittings',
  'Bearings & Seals',
  'Filters & Strainers',
  'Other',
];

function emptyProduct() {
  return {
    productName: '',
    category: '',
    partNumber: '',
    price: '',
    quantity: '',
    description: '',
  };
}

export default function ProviderForm() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [company, setCompany] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    description: '',
  });

  const [products, setProducts] = useState([emptyProduct()]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCompanyChange = (e) => {
    setCompany({ ...company, [e.target.name]: e.target.value });
  };

  const handleProductChange = (index, e) => {
    const updated = [...products];
    updated[index] = { ...updated[index], [e.target.name]: e.target.value };
    setProducts(updated);
  };

  const addProduct = () => {
    setProducts([...products, emptyProduct()]);
  };

  const removeProduct = (index) => {
    if (products.length === 1) return;
    setProducts(products.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Basic validation
    if (!company.companyName || !company.contactPerson || !company.email || !company.phone || !company.address) {
      setError('Please fill in all required company details');
      return;
    }

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.productName || !p.category || !p.price) {
        setError(`Please fill in required fields for Product ${i + 1} (Name, Category, Price)`);
        return;
      }
    }

    setLoading(true);
    try {
      await axios.post(
        `${API}/provider/register`,
        { ...company, products },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess('🎉 Registration successful! Your company and products are now listed.');
      setTimeout(() => navigate('/provider/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="ocean-bg">
        <div className="particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>

      <Navbar />

      <div className="page-container page-with-nav">
        <div className="content-container content-container-lg">
          <div className="glass-card provider-form-card">
            {/* Header */}
            <div className="form-header">
              <h2>🏭 Provider Registration</h2>
              <p>Fill in your company details and list your marine spare parts</p>
            </div>

            {/* Alerts */}
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            <form onSubmit={handleSubmit}>
              {/* Company Details Section */}
              <div className="form-section">
                <div className="form-section-title">
                  <span className="form-section-icon">🏢</span>
                  Company Details
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="companyName">Company Name *</label>
                  <input
                    id="companyName"
                    className="form-input"
                    type="text"
                    name="companyName"
                    placeholder="e.g. Marine Parts International"
                    value={company.companyName}
                    onChange={handleCompanyChange}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="contactPerson">Contact Person *</label>
                    <input
                      id="contactPerson"
                      className="form-input"
                      type="text"
                      name="contactPerson"
                      placeholder="Full name"
                      value={company.contactPerson}
                      onChange={handleCompanyChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="companyEmail">Email *</label>
                    <input
                      id="companyEmail"
                      className="form-input"
                      type="email"
                      name="email"
                      placeholder="contact@company.com"
                      value={company.email}
                      onChange={handleCompanyChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="phone">Phone *</label>
                    <input
                      id="phone"
                      className="form-input"
                      type="tel"
                      name="phone"
                      placeholder="+91 9876543210"
                      value={company.phone}
                      onChange={handleCompanyChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="country">Country</label>
                    <input
                      id="country"
                      className="form-input"
                      type="text"
                      name="country"
                      placeholder="India"
                      value={company.country}
                      onChange={handleCompanyChange}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="address">Address *</label>
                    <input
                      id="address"
                      className="form-input"
                      type="text"
                      name="address"
                      placeholder="Street address"
                      value={company.address}
                      onChange={handleCompanyChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="city">City</label>
                    <input
                      id="city"
                      className="form-input"
                      type="text"
                      name="city"
                      placeholder="Mumbai"
                      value={company.city}
                      onChange={handleCompanyChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="companyDescription">Company Description</label>
                  <textarea
                    id="companyDescription"
                    className="form-textarea"
                    name="description"
                    placeholder="Brief description of your company and specializations..."
                    value={company.description}
                    onChange={handleCompanyChange}
                  />
                </div>
              </div>

              {/* Products Section */}
              <div className="form-section">
                <div className="form-section-title">
                  <span className="form-section-icon">⚙️</span>
                  Products / Spare Parts
                </div>

                {products.map((product, index) => (
                  <div key={index} className="product-card">
                    <div className="product-card-header">
                      <span className="product-card-title">Product {index + 1}</span>
                      {products.length > 1 && (
                        <button
                          type="button"
                          className="product-remove-btn"
                          onClick={() => removeProduct(index)}
                          title="Remove product"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Product Name *</label>
                        <input
                          className="form-input"
                          type="text"
                          name="productName"
                          placeholder="e.g. Marine Engine Piston"
                          value={product.productName}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Category *</label>
                        <select
                          className="form-select"
                          name="category"
                          value={product.category}
                          onChange={(e) => handleProductChange(index, e)}
                        >
                          <option value="">Select category</option>
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Part Number</label>
                        <input
                          className="form-input"
                          type="text"
                          name="partNumber"
                          placeholder="e.g. MP-2024-A1"
                          value={product.partNumber}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Price *</label>
                        <input
                          className="form-input"
                          type="number"
                          name="price"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={product.price}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Quantity in Stock</label>
                        <input
                          className="form-input"
                          type="number"
                          name="quantity"
                          placeholder="0"
                          min="0"
                          value={product.quantity}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Description</label>
                        <input
                          className="form-input"
                          type="text"
                          name="description"
                          placeholder="Brief description..."
                          value={product.description}
                          onChange={(e) => handleProductChange(index, e)}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button type="button" className="add-product-btn" onClick={addProduct}>
                  ➕ Add Another Product
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="btn btn-primary btn-block btn-lg"
                disabled={loading}
              >
                {loading ? <span className="spinner"></span> : '🚀 Register as Provider'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
