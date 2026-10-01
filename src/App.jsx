import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/auth/Login";
import OwnerRegister from "./pages/auth/OwnerRegister";
import PropertyWizard from "./pages/onboarding/PropertyWizard";
import RegisterTenant from "./pages/owner/RegisterTenant";
import WizardSuccess from "./pages/onboarding/components/WizardSuccess";
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import TenantDashboard from "./pages/owner/TenantDashboard";
import CaretakerDashboard from "./pages/owner/CaretakerDashboard";
import InviteCaretaker from "./pages/owner/InviteCaretaker";
import CaretakerList from "./pages/owner/CaretakerList";
import CaretakerInvited from "./pages/owner/CaretakerInvited";

const PropertyDetailPlaceholder = () => <div>Property Details</div>;
const TenantDetailPlaceholder = () => <div>Tenant Details</div>;

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<OwnerRegister />} />
          <Route path="/setup" element={<PropertyWizard />} />
          <Route path="/wizard-success" element={<WizardSuccess />} />
          <Route path="/owner/dashboard" element={<OwnerDashboard />} />
          {/* Real dashboards, replacing the old placeholder divs */}
          <Route path="/tenant/dashboard" element={<TenantDashboard />} />
          <Route path="/caretaker/dashboard" element={<CaretakerDashboard />} />
          {/* Kept both URLs so nothing that already links to either one breaks:
              dev used /register-sub-user, Sheila's branch used /register-tenant */}
          <Route path="/register-sub-user" element={<RegisterTenant />} />
          <Route path="/register-tenant" element={<RegisterTenant />} />
          <Route path="/owner/tenants/add" element={<RegisterTenant />} />
          <Route path="/owner/tenants/register" element={<RegisterTenant />} />
          <Route
            path="/owner/tenants/:tenantId"
            element={<TenantDetailPlaceholder />}
          />
          <Route path="/owner/tenant/add" element={<RegisterTenant />} />
          <Route path="/owner/tenant/register" element={<RegisterTenant />} />
          <Route
            path="/owner/tenant/:tenantId"
            element={<TenantDetailPlaceholder />}
          />
          <Route
            path="/owner/properties/:propertyId"
            element={<PropertyDetailPlaceholder />}
          />
          <Route path="/owner/caretakers" element={<CaretakerList />} />
          <Route
            path="/owner/caretakers/invite"
            element={<InviteCaretaker />}
          />
          <Route
            path="/owner/caretakers/invited"
            element={<CaretakerInvited />}
          />
          <Route
            path="*"
            element={<Navigate to="/owner/dashboard" replace />}
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
