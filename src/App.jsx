import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';

// Dummy components for your team to replace later
const OwnerRegister = () => <div>Owner Registration Placeholder (Dev 2)</div>;
const PropertyWizard = () => <div>Property Wizard Placeholder (Dev 3 & 4)</div>;
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