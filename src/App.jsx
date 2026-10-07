// src/App.jsx

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- Guards & Security ---
import ProtectedRoute from './components/ProtectedRoute';
import AccountSuspended from './pages/AccountSuspended';
import NotFound from './pages/NotFound';

// --- Auth & Onboarding ---
import LandingWelcome from './pages/LandingWelcome';
import Login from './pages/auth/Login';
import OwnerRegister from './pages/auth/OwnerRegister';
import PropertyWizard from './pages/onboarding/PropertyWizard';
import WizardSuccess from './pages/onboarding/components/WizardSuccess';

// --- Layouts ---
import OwnerLayout from './layouts/OwnerLayout';
import AdminLayout from './layouts/AdminLayout';
import CaretakerLayout from './layouts/CaretakerLayout';
import TenantLayout from './layouts/TenantLayout';

// --- Owner Pages ---
import OwnerOverview from './pages/owner/OwnerOverview';
import OwnerAnnouncements from './pages/owner/OwnerAnnouncements';

// Properties
import PropertyList from './pages/owner/properties/PropertyList';
import PropertyProfile from './pages/owner/properties/PropertyProfile';
import PropertyDetails from './pages/owner/properties/PropertyDetails'; 

// Tenants (Using the real TenantDetail component instead of the placeholder)
import TenantList from './pages/owner/tenants/TenantList';
import RegisterTenant from './pages/owner/tenants/RegisterTenant';
import TenantDetail from './pages/owner/tenants/TenantDetail'; // 👈 Pointing to your tenant detail component

// Caretakers
import CaretakerList from './pages/owner/caretakers/CaretakerList';
import InviteCaretaker from './pages/owner/caretakers/InviteCaretaker';
import CaretakerInvited from './pages/owner/caretakers/CaretakerInvited';
import CaretakerDetail from './pages/owner/caretakers/CaretakerDetail';

// Payments & Maintenance
import PaymentsPage from './pages/owner/PaymentsPage';
import MaintenancePage from './pages/owner/MaintenancePage';

// --- Admin Pages ---
import AdminOverview from './pages/admin/AdminOverview';
import ManageOwners from './pages/admin/ManageOwners';
import OwnerDetails from './pages/admin/OwnerDetails';
import AdminAnnouncements from './pages/admin/AdminAnnouncements';
import AdminSettings from './pages/admin/AdminSettings';

// --- Tenant & Caretaker Pages ---
import TenantDashboard from './pages/tenant/TenantDashboard';
import CaretakerDashboard from './pages/caretaker/CaretakerDashboard';

// --- Placeholders for other secondary routes ---
const AdminPropertiesPlaceholder = () => <div className="p-6">Global Properties List</div>;
const AdminTenantsPlaceholder = () => <div className="p-6">Global Tenants List</div>;
const AdminCaretakersPlaceholder = () => <div className="p-6">Global Caretakers List</div>;

function App() {
  return (
    <Router>
      <Routes>
        {/* --- Public Routes --- */}
        <Route path="/" element={<LandingWelcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<OwnerRegister />} />
        <Route path="/suspended" element={<AccountSuspended />} />
        
        {/* --- External Registration Alias --- */}
        <Route path="/register-sub-user" element={<RegisterTenant />} />

        {/* --- Onboarding Wizard (Owner Protected) --- */}
        <Route 
          path="/setup" 
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <PropertyWizard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/wizard-success" 
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <WizardSuccess />
            </ProtectedRoute>
          } 
        />

        {/* --- Tenant & Caretaker Dashboards --- */}
        <Route 
          path="/tenant/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['tenant']}>
              <TenantLayout>
                {(activeTab) => <TenantDashboard activeTab={activeTab} />}
              </TenantLayout>
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/caretaker/dashboard" 
          element={
            <ProtectedRoute allowedRoles={['caretaker']}>
              <CaretakerLayout>
                <CaretakerDashboard />
              </CaretakerLayout>
            </ProtectedRoute>
          } 
        />

        {/* --- Legacy / Redirect Aliases --- */}
        <Route path="/owner/dashboard" element={<Navigate to="/owner" replace />} />
        <Route path="/admin/dashboard" element={<Navigate to="/admin/overview" replace />} />

        {/* --- Nested Admin Routes --- */}
        <Route 
          path="/admin" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/admin/overview" replace />} />
          <Route path="overview" element={<AdminOverview />} />
          
          <Route path="owners">
            <Route index element={<ManageOwners />} />
            <Route path=":ownerId" element={<OwnerDetails />} />
          </Route>

          <Route path="announcements" element={<AdminAnnouncements />} />
          <Route path="settings" element={<AdminSettings />} />

          <Route path="properties" element={<AdminPropertiesPlaceholder />} />
          <Route path="tenants" element={<AdminTenantsPlaceholder />} />
          <Route path="caretakers" element={<AdminCaretakersPlaceholder />} />
        </Route>

        {/* --- Nested Owner Routes --- */}
        <Route 
          path="/owner" 
          element={
            <ProtectedRoute allowedRoles={['owner']}>
              <OwnerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<OwnerOverview />} />

          {/* Properties Group */}
          <Route path="properties">
            <Route index element={<PropertyList />} />
            <Route path=":id" element={<PropertyProfile />} />
            <Route path=":id/edit" element={<PropertyDetails />} />   
          </Route>

          {/* Tenants Group */}
          <Route path="tenants">
            <Route index element={<TenantList />} />
            <Route path="register" element={<RegisterTenant />} />
            <Route path="add" element={<RegisterTenant />} />
            <Route path=":tenantId" element={<TenantDetail />} />
          </Route>

          {/* Caretakers Group */}
          <Route path="caretakers">
            <Route index element={<CaretakerList />} />
            <Route path="invite" element={<InviteCaretaker />} />
            <Route path="invited" element={<CaretakerInvited />} />
            <Route path=":caretakerId" element={<CaretakerDetail />} />
          </Route>

          {/* Additional Operational Pages */}
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="announcements" element={<OwnerAnnouncements />} />
        </Route>

        {/* --- 404 Fallback Route --- */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;