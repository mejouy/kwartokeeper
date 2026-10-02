import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- Auth & Onboarding ---
import Login from './pages/auth/Login';
import OwnerRegister from './pages/auth/OwnerRegister';
import PropertyWizard from './pages/onboarding/PropertyWizard';
import WizardSuccess from './pages/onboarding/components/WizardSuccess';
import OwnerDashboard from './pages/owner/OwnerDashboard';
import InviteCaretaker from './pages/owner/InviteCaretaker';
import CaretakerList from './pages/owner/CaretakerList';
import CaretakerInvited from './pages/owner/CaretakerInvited';

const TenantDashboard = () => <div>Tenant Dashboard</div>;
const CaretakerDashboard = () => <div>Caretaker Dashboard</div>;
const PropertyDetailPlaceholder = () => <div>Property Details</div>;
const TenantDetailPlaceholder = () => <div>Tenant Details</div>;

function App() {
  return (
    <Router>
      <Routes>
        {/* --- Public & Auth Routes --- */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<OwnerRegister />} />
        <Route path="/setup" element={<PropertyWizard />} />
        <Route path="/wizard-success" element={<WizardSuccess />} />
        
        {/* --- External Registration Alias --- */}
        <Route path="/register-sub-user" element={<RegisterTenant />} />

        {/* --- Other Dashboards --- */}
        <Route path="/tenant/dashboard" element={<TenantDashboard />} />
        <Route path="/caretaker/dashboard" element={<CaretakerDashboard />} />
        <Route path="/register-sub-user" element={<RegisterTenant />} />
        <Route path="/owner/tenants/add" element={<RegisterTenant />} />
        <Route path="/owner/tenants/register" element={<RegisterTenant />} />
        <Route path="/owner/tenants/:tenantId" element={<TenantDetailPlaceholder />} />
        <Route path="/owner/properties/:propertyId" element={<PropertyDetailPlaceholder />} />
        <Route path="/owner/caretakers" element={<CaretakerList />} />
        <Route path="/owner/caretakers/invite" element={<InviteCaretaker />} />
        <Route path="/owner/caretakers/invited" element={<CaretakerInvited />} />
      </Routes>
    </Router>
  );
}

export default App;