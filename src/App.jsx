import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import BottomNav from './components/BottomNav';
import Home from './view/Home';
import Product from './view/Product';
import Order from './view/Order';
import Payment from './view/Payment';
import Stock from './view/Stock';
import Report from './view/Report';
import Settings from './view/Settings';
import Activation from './view/Activation';
import { Navigate, useLocation } from 'react-router-dom';
import './App.css';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo: error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', marginTop: '50px' }}>
          <h2 style={{ color: 'red' }}>Terjadi kesalahan sistem, silakan muat ulang</h2>
          <p style={{ color: 'gray', fontSize: '12px', marginTop: '10px' }}>{this.state.errorInfo?.toString()}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{ padding: '10px 20px', marginTop: '20px', borderRadius: '8px', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            Muat Ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ProtectedRoute = ({ children }) => {
  const isActivated = localStorage.getItem('isActivated') === 'true';
  if (!isActivated) {
    return <Navigate to="/activation" replace />;
  }
  return children;
};

const AppContent = () => {
  const location = useLocation();
  const showNav = location.pathname !== '/activation' && location.pathname !== '/settings';

  return (
    <>
      <div className="page-container" style={{ paddingBottom: showNav ? '80px' : '20px' }}>
        <Routes>
          <Route path="/activation" element={<Activation />} />
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
          <Route path="/product" element={<ProtectedRoute><Product /></ProtectedRoute>} />
          <Route path="/order" element={<ProtectedRoute><Order /></ProtectedRoute>} />
          <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
          <Route path="/stock" element={<ProtectedRoute><Stock /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
      <Toaster position="bottom-center" />
    </>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
      </Router>
    </ErrorBoundary>
  );
}

export default App;
