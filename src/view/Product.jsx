import { useState, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { productModel } from '../model/product_model';
import { Edit2, Trash2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useHardwareBack } from '../hooks/useHardwareBack';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '../utils/cropImage';
import './Product.css';

function Product() {
  const products = useLiveQuery(() => productModel.getAllProducts()) || [];
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const navigate = useNavigate();

  useHardwareBack(() => {
    if (showModal) {
      setShowModal(false);
    } else if (showDeleteModal) {
      setShowDeleteModal(false);
    } else {
      navigate('/');
    }
  });
  
  // Form State
  const [currentId, setCurrentId] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [image, setImage] = useState('');

  // Cropping State
  const [isCropping, setIsCropping] = useState(false);
  const [rawImage, setRawImage] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Category & Search Filter State
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  
  const toTitleCase = (str) => {
    if (!str) return 'Uncategorized';
    return str.split(' ')
      .filter(word => word.length > 0)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const categories = ['Semua', ...new Set(products.map(p => p.category || 'Uncategorized'))];
  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'Semua' || (p.category || 'Uncategorized').toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleAddClick = () => {
    const dbCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
    setIsEditing(false);
    setIsAddingNewCategory(dbCategories.length === 0);
    setName('');
    setCategory('');
    setPrice('');
    setStock('');
    setImage('');
    setIsCropping(false);
    setShowModal(true);
  };

  const handleEditClick = (product) => {
    const dbCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
    setIsEditing(true);
    setIsAddingNewCategory(dbCategories.length === 0);
    setCurrentId(product.id);
    setName(product.name);
    setCategory(product.category || 'Uncategorized');
    setPrice(product.price.toString());
    setStock(product.stock.toString());
    setImage(product.image || '');
    setIsCropping(false);
    setShowModal(true);
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      await productModel.deleteProduct(productToDelete.id);
      toast.success('Produk berhasil dihapus.');
      setShowDeleteModal(false);
      setProductToDelete(null);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        const img = new Image();
        img.onload = () => {
          const ratio = img.width / img.height;
          if (Math.abs(ratio - 1) > 0.01) {
            setRawImage(result);
            setIsCropping(true);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
          } else {
            setImage(result);
          }
        };
        img.src = result;
      };
      reader.readAsDataURL(file);
      e.target.value = ''; // Reset input so same file can be selected again
    }
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleApplyCrop = async () => {
    try {
      const croppedImageBase64 = await getCroppedImg(rawImage, croppedAreaPixels);
      setImage(croppedImageBase64);
      setIsCropping(false);
      setRawImage(null);
    } catch (e) {
      console.error(e);
      toast.error('Gagal memotong gambar.');
    }
  };

  const handleCancelCrop = () => {
    setIsCropping(false);
    setRawImage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price || (!isEditing && !stock)) return;

    if (name.length < 3 || name.length > 50) {
      toast.error("Product name must be between 3 and 50 characters!");
      return;
    }

    if (isAddingNewCategory && (category.length < 3 || category.length > 25)) {
      toast.error("Category name must be between 3 and 25 characters!");
      return;
    }

    const finalCategory = toTitleCase(category);

    if (isEditing) {
      await productModel.updateProduct(currentId, {
        name,
        category: finalCategory,
        price: parseInt(price),
        image
      });
      toast.success('Produk berhasil diupdate.');
    } else {
      await productModel.addProduct({
        name,
        category: finalCategory,
        price: parseInt(price),
        stock: parseInt(stock),
        image
      });
      toast.success('Produk berhasil disimpan.');
    }
    setShowModal(false);
  };

  return (
    <div className="product-container">
      <div className="header-row">
        <h1 className="header-title">Produk</h1>
        <button className="btn-primary add-new-btn" onClick={handleAddClick}>
          + Tambah Produk
        </button>
      </div>

      <div className="search-container" style={{ position: 'relative', marginBottom: '8px' }}>
        <input 
          id="searchInputProduct"
          type="text" 
          placeholder="Cari nama produk..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
          style={{ width: '100%', padding: '10px 70px 10px 20px', borderRadius: '50px', border: '1px solid #ddd', fontSize: '14px' }}
        />
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {searchQuery.length > 0 && (
            <button 
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTimeout(() => document.getElementById('searchInputProduct')?.focus(), 0);
              }}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={20} strokeWidth={2} />
            </button>
          )}
          <button 
            type="button"
            onClick={() => document.getElementById('searchInputProduct')?.blur()}
            style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <Search size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="category-tabs">
        {categories.map(cat => (
          <button 
            key={cat} 
            className={`tab-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
          <p>Produk tidak ditemukan.</p>
        </div>
      ) : (
        <div className="product-grid">
          {filteredProducts.map(product => (
          <div key={product.id} className="product-grid-item">
            {product.image ? (
              <img src={product.image} alt={product.name} className="product-img-thumb" />
            ) : (
              <div className="product-img-placeholder">Tidak ada gambar</div>
            )}
            
            <div className="item-info">
              <h3 className="item-name">{product.name}</h3>
              <div style={{ marginBottom: '4px' }}>
                <span className="category-badge">{product.category || 'Uncategorized'}</span>
              </div>
              <p className="item-price">Rp {product.price.toLocaleString('id-ID')}</p>
            </div>
            
            <div className="item-actions">
              <p className="item-stock">Stok: {product.stock}</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="action-btn edit" onClick={() => handleEditClick(product)}>
                  <Edit2 size={14} />
                </button>
                <button className="action-btn delete" onClick={() => handleDeleteClick(product)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            {isCropping ? (
              <>
                <h2 className="modal-title">Potong Gambar (1:1)</h2>
                <div style={{ position: 'relative', width: '100%', height: '300px', backgroundColor: '#333', marginBottom: '16px', borderRadius: '8px', overflow: 'hidden' }}>
                  <Cropper
                    image={rawImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-secondary" onClick={handleCancelCrop}>Batal</button>
                  <button type="button" className="btn-primary" onClick={handleApplyCrop}>Terapkan</button>
                </div>
              </>
            ) : (
              <>
                <h2 className="modal-title">{isEditing ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
                <form onSubmit={handleSubmit} className="product-form">
              <div className="form-group">
                <label>Nama Produk</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="misal: Oolong Tea"
                  minLength={3}
                  maxLength={50}
                  required
                />
              </div>
              <div className="form-group">
                <label>Kategori</label>
                {isAddingNewCategory ? (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      autoFocus
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)} 
                      placeholder="Ketik kategori baru..."
                      minLength={3}
                      maxLength={25}
                      required
                      style={{ flex: 1 }}
                    />
                    {[...new Set(products.map(p => p.category).filter(Boolean))].length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsAddingNewCategory(false);
                          setCategory('');
                        }}
                        style={{ 
                          padding: '12px', 
                          backgroundColor: '#f5f5f5', 
                          borderRadius: '8px', 
                          fontWeight: 'bold',
                          color: 'var(--text-light)',
                          border: '1px solid #ddd'
                        }}
                      >
                        X
                      </button>
                    )}
                  </div>
                ) : (
                  <select 
                    value={category} 
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW_TRIGGER') {
                        setIsAddingNewCategory(true);
                        setCategory('');
                      } else {
                        setCategory(e.target.value);
                      }
                    }} 
                    className="product-select"
                    required
                  >
                    <option value="" disabled hidden>Pilih Kategori</option>
                    {[...new Set(products.map(p => p.category).filter(Boolean))].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="ADD_NEW_TRIGGER">+ Tambah Kategori Baru...</option>
                  </select>
                )}
              </div>
              <div className="form-group">
                <label>Harga (Rp)</label>
                <input 
                  type="number" 
                  value={price} 
                  onChange={(e) => setPrice(e.target.value)} 
                  placeholder="10000"
                  required
                />
              </div>
              {!isEditing && (
                <div className="form-group">
                  <label>Stok Awal (Cup)</label>
                  <input 
                    type="number" 
                    value={stock} 
                    onChange={(e) => setStock(e.target.value)} 
                    placeholder="50"
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>Unggah Gambar</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageChange}
                />
                {image && <img src={image} alt="Preview" className="img-preview" />}
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
            </>
            )}
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 className="modal-title" style={{ color: '#000000' }}>Hapus Produk?</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-light)' }}>
              Anda akan menghapus <strong>{productToDelete?.name}</strong>. Aksi ini tidak dapat dibatalkan.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowDeleteModal(false)}>Batal</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={confirmDelete}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Product;
