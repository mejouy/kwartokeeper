import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Import your actual files
import Login from "./pages/auth/Login";
import OwnerRegister from "./pages/auth/OwnerRegister";
import PropertyWizard from "./pages/onboarding/PropertyWizard";
import RegisterSubUser from "./pages/owner/RegisterSubUser";
import WizardSuccess from "./pages/onboarding/components/WizardSuccess";
import CaretakerList from "./pages/owner/CaretakerList";

// Temporary Dashboard Placeholders (You can create real files for these in a future sprint)
const OwnerDashboard = () => <div>Owner Dashboard</div>;
const TenantDashboard = () => <div>Tenant Dashboard</div>;
const CaretakerDashboard = () => <div>Caretaker Dashboard</div>;
const CaretakerList = () => <div>Caretaker List</div>;

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
        <Route path="/wizard-success" element={<WizardSuccess />} />
        <Route path="/owner/dashboard" element={<OwnerDashboard />} />
        <Route path="/tenant/dashboard" element={<TenantDashboard />} />
        <Route path="/caretaker/dashboard" element={<CaretakerDashboard />} />

        {/* Sub-user Registration */}
        <Route path="/register-sub-user" element={<RegisterSubUser />} />

        {/* Caretaker List */}
        <Route path="/owner/caretakers" element={<CaretakerList />} />
      </Routes>
    </Router>
  );
}

export default App;
