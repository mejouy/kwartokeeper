import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import your actual files
import Login from './pages/auth/Login';
import OwnerRegister from './pages/auth/OwnerRegister';
import PropertyWizard from './pages/onboarding/PropertyWizard';

// Temporary Dashboard Placeholders (You can create real files for these in a future sprint)
const OwnerDashboard = () => <div>Owner Dashboard</div>;
const TenantDashboard = () => <div>Tenant Dashboard</div>;
const CaretakerDashboard = () => <div>Caretaker Dashboard</div>;

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route redirects to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Auth Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<OwnerRegister />} />
        
        {/* Onboarding & Dashboards */}
        <Route path="/setup" element={<PropertyWizard />} />
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        <Route path="/tenant/dashboard" element={<TenantDashboard />} />
        <Route path="/caretaker/dashboard" element={<CaretakerDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;