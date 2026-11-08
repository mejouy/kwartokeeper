// src/App.jsx

import { lazy } from "react";
import PageBoundary from "./components/PageBoundary";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// --- Guards & Security ---
import ProtectedRoute from "./components/ProtectedRoute";
import RedirectIfAuthenticated from "./components/RedirectIfAuthenticated";
import PushRegistrar from "./components/PushRegistrar";
const AccountSuspended = lazy(() => import("./pages/AccountSuspended"));
const NotFound = lazy(() => import("./pages/NotFound"));

// --- Auth & Onboarding ---
import LandingWelcome from "./pages/LandingWelcome";
import Login from "./pages/auth/Login";
const SetPassword = lazy(() => import("./pages/auth/SetPassword"));
const OwnerRegister = lazy(() => import("./pages/auth/OwnerRegister"));
const OwnerWelcome = lazy(() => import("./pages/onboarding/OwnerWelcome"));
const PropertyWizard = lazy(() => import("./pages/onboarding/PropertyWizard"));
const WizardSuccess = lazy(() => import("./pages/onboarding/components/WizardSuccess"));

// --- Layouts ---
import OwnerLayout from "./layouts/OwnerLayout";
import AdminLayout from "./layouts/AdminLayout";
import CaretakerLayout from "./layouts/CaretakerLayout";
import TenantLayout from "./layouts/TenantLayout";

// --- Owner Pages ---
const OwnerOverview = lazy(() => import("./pages/owner/OwnerOverview"));
const OwnerAnnouncements = lazy(() => import("./pages/owner/OwnerAnnouncements"));
const OwnerAccount = lazy(() => import("./pages/owner/OwnerAccount"));
const OwnerReports = lazy(() => import("./pages/owner/OwnerReports"));

// Properties
const PropertyList = lazy(() => import("./pages/owner/properties/PropertyList"));
const PropertyProfile = lazy(() => import("./pages/owner/properties/PropertyProfile"));
const PropertyDetails = lazy(() => import("./pages/owner/properties/PropertyDetails"));

// Tenants
const TenantList = lazy(() => import("./pages/owner/tenants/TenantList"));
const RegisterTenant = lazy(() => import("./pages/owner/tenants/RegisterTenant"));
const TenantDetail = lazy(() => import("./pages/owner/tenants/TenantDetail"));

// Caretakers
const CaretakerList = lazy(() => import("./pages/owner/caretakers/CaretakerList"));
const InviteCaretaker = lazy(() => import("./pages/owner/caretakers/InviteCaretaker"));
const CaretakerInvited = lazy(() => import("./pages/owner/caretakers/CaretakerInvited"));
const CaretakerDetail = lazy(() => import("./pages/owner/caretakers/CaretakerDetail"));

// Payments & Maintenance
const PaymentsPage = lazy(() => import("./pages/owner/PaymentsPage"));
const MaintenancePage = lazy(() => import("./pages/owner/MaintenancePage"));

// --- Admin Pages ---
const AdminOverview = lazy(() => import("./pages/admin/AdminOverview"));
const ManageOwners = lazy(() => import("./pages/admin/ManageOwners"));
const OwnerDetails = lazy(() => import("./pages/admin/OwnerDetails"));
const AdminAnnouncements = lazy(() => import("./pages/admin/AdminAnnouncements"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

// --- Tenant & Caretaker Pages ---
const TenantDashboard = lazy(() => import("./pages/tenant/TenantDashboard"));
const CaretakerDashboard = lazy(() => import("./pages/caretaker/CaretakerDashboard"));

// --- Placeholders for other secondary routes ---
const AdminPropertiesPlaceholder = () => (
  <div className="p-6">Global Properties List</div>
);
const AdminTenantsPlaceholder = () => (
  <div className="p-6">Global Tenants List</div>
);
const AdminCaretakersPlaceholder = () => (
  <div className="p-6">Global Caretakers List</div>
);

function App() {
  return (
    <Router>
      <PushRegistrar />
      {/* Each page's code downloads when it's first opened (smaller first load) */}
      <PageBoundary fullScreen>
      <Routes>
        {/* --- Public Routes --- */}
        {/* "/" and "/login" skip straight to the user's role home if a session
            was already restored on app launch (see RedirectIfAuthenticated). */}
        <Route
          path="/"
          element={
            <RedirectIfAuthenticated>
              <LandingWelcome />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <Login />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/signup" element={<OwnerRegister />} />
        <Route path="/suspended" element={<AccountSuspended />} />
        {/* First sign-in with a temporary password: any role, but must be signed in */}
        <Route
          path="/set-password"
          element={
            <ProtectedRoute>
              <SetPassword />
            </ProtectedRoute>
          }
        />

        {/* --- External Registration Alias --- */}
        <Route path="/register-sub-user" element={<RegisterTenant />} />

        {/* --- Onboarding Wizard (Owner Protected) --- */}
        <Route
          path="/welcome"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <OwnerWelcome />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <PropertyWizard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/wizard-success"
          element={
            <ProtectedRoute allowedRoles={["owner"]}>
              <WizardSuccess />
            </ProtectedRoute>
          }
        />

        {/* --- Tenant Routes --- */}
        <Route
          path="/tenant"
          element={<Navigate to="/tenant/dashboard" replace />}
        />
        <Route
          path="/tenant/dashboard"
          element={
            <ProtectedRoute allowedRoles={["tenant"]}>
              <TenantLayout>
                {(activeTab) => <TenantDashboard activeTab={activeTab} />}
              </TenantLayout>
            </ProtectedRoute>
          }
        />

        {/* --- Caretaker Routes --- */}
        <Route
          path="/caretaker"
          element={<Navigate to="/caretaker/dashboard" replace />}
        />
        <Route
          path="/caretaker/dashboard"
          element={
            <ProtectedRoute allowedRoles={["caretaker"]}>
              <CaretakerLayout>
                <CaretakerDashboard />
              </CaretakerLayout>
            </ProtectedRoute>
          }
        />

        {/* --- Legacy / Redirect Aliases --- */}
        <Route
          path="/owner/dashboard"
          element={<Navigate to="/owner" replace />}
        />
        <Route
          path="/admin/dashboard"
          element={<Navigate to="/admin/overview" replace />}
        />

        {/* --- Nested Admin Routes --- */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
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
            <ProtectedRoute allowedRoles={["owner"]}>
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
          <Route path="account" element={<OwnerAccount />} />
          <Route path="reports" element={<OwnerReports />} />
        </Route>

        {/* --- 404 Fallback Route --- */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </PageBoundary>
    </Router>
  );
}

export default App;
