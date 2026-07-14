import { NavLink } from 'react-router-dom';
import { Home, Coffee, ShoppingCart, List, TrendingUp } from 'lucide-react';
import './BottomNav.css';

function BottomNav() {
  return (
    <div className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Home size={24} />
        <span>Kasir</span>
      </NavLink>
      <NavLink to="/product" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Coffee size={24} />
        <span>Produk</span>
      </NavLink>
      <NavLink to="/order" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <div className="nav-item-highlight">
          <ShoppingCart size={24} color="#fff" />
        </div>
        <span>Order Baru</span>
      </NavLink>
      <NavLink to="/stock" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <List size={24} />
        <span>Stok</span>
      </NavLink>
      <NavLink to="/report" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <TrendingUp size={24} />
        <span>Laporan</span>
      </NavLink>
    </div>
  );
}

export default BottomNav;
