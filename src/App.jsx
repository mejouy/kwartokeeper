import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- Auth & Onboarding ---
import Login from './pages/auth/Login';
import OwnerRegister from './pages/auth/OwnerRegister';
import PropertyWizard from './pages/onboarding/PropertyWizard';

import WizardSuccess from './pages/onboarding/components/WizardSuccess';



import Payments from './pages/tenant/payments';
import TenantDetails from './pages/owner/TenantDetails';

// --- Layouts ---
import OwnerLayout from './layouts/OwnerLayout';
import AdminLayout from './layouts/AdminLayout';

// --- Owner Pages ---
import OwnerOverview from './pages/owner/OwnerOverview';

// Properties
import PropertyList from './pages/owner/properties/PropertyList';
import PropertyProfile from './pages/owner/properties/PropertyProfile';
import PropertyDetails from './pages/owner/properties/PropertyDetails';

// Tenants
import TenantList from './pages/owner/tenants/TenantList';
import RegisterTenant from './pages/owner/tenants/RegisterTenant';

// Caretakers
import CaretakerList from './pages/owner/caretakers/CaretakerList';
import InviteCaretaker from './pages/owner/caretakers/InviteCaretaker';
import CaretakerInvited from './pages/owner/caretakers/CaretakerInvited';

// Payments & Maintenance
import PaymentsPage from './pages/owner/PaymentsPage';
import MaintenancePage from './pages/owner/MaintenancePage';

// --- Admin Pages ---
import AdminOverview from './pages/admin/AdminOverview';
import ManageOwners from './pages/admin/ManageOwners';

// --- Tenant & Caretaker Pages ---
import TenantDashboard from './pages/tenant/TenantDashboard';
import CaretakerDashboard from './pages/caretaker/CaretakerDashboard';

// --- Placeholders ---
const TenantDetailPlaceholder = () => <div>Tenant Details</div>;
const PropertyDetailPlaceholder = () => <div>Property Details</div>;

// Admin Placeholders (To be replaced with real pages next)
const AdminPropertiesPlaceholder = () => <div>Global Properties List</div>;
const AdminTenantsPlaceholder = () => <div>Global Tenants List</div>;
const AdminCaretakersPlaceholder = () => <div>Global Caretakers List</div>;

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
        <Route path="/owner/tenants/:tenantId" element={<TenantDetails />} />

        <Route path="/owner/tenants/:tenantId" element={<TenantDetailPlaceholder />} />
        <Route path="/owner/properties/:propertyId" element={<PropertyDetailPlaceholder />} />
        <Route path="/owner/caretakers" element={<CaretakerList />} />
        <Route path="/owner/tenants/:tenantId" element={<TenantDetailPlaceholder />} />

        <Route path="/register-sub-user" element={<RegisterTenant />} />
        <Route path="/owner/caretakers/invite" element={<InviteCaretaker />} />
        <Route path="/owner/caretakers/invited" element={<CaretakerInvited />} />
        {/* --- Redirect old dashboard link to new layout index --- */}
        <Route
          path="/owner/dashboard"
          element={<Navigate to="/owner" replace />}
        />
        <Route
          path="/admin/dashboard"
          element={<Navigate to="/admin/overview" replace />}
        />

        {/* --- Nested Admin Routes --- */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          <Route path="owners" element={<ManageOwners />} />
          <Route path="properties" element={<AdminPropertiesPlaceholder />} />
          <Route path="tenants" element={<AdminTenantsPlaceholder />} />
          <Route path="caretakers" element={<AdminCaretakersPlaceholder />} />
        </Route>

        {/* --- Nested Owner Routes --- */}
        <Route path="/owner" element={<OwnerLayout />}>
          {/* Index route loads OwnerOverview when visiting /owner */}
          <Route index element={<OwnerOverview />} />

          {/* Properties Group */}
          <Route path="properties">
            <Route index element={<PropertyList />} />

            {/* View the property profile */}
            <Route path=":id" element={<PropertyProfile />} />

            {/* Edit the property details */}
            <Route path=":id/edit" element={<PropertyDetails />} />
          </Route>

          {/* Tenants Group */}
          <Route path="tenants">
            <Route index element={<TenantList />} />
            <Route path="register" element={<RegisterTenant />} />
            <Route path="add" element={<RegisterTenant />} />
            <Route path=":tenantId" element={<TenantDetailPlaceholder />} />
          </Route>

          {/* Caretakers Group */}
          <Route path="caretakers">
            <Route index element={<CaretakerList />} />
            <Route path="invite" element={<InviteCaretaker />} />
            <Route path="invited" element={<CaretakerInvited />} />
          </Route>

          {/* Additional Features */}
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
