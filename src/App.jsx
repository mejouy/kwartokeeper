import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'; 
import Login from './pages/auth/Login'; 
import OwnerRegister from './pages/auth/OwnerRegister';
 import PropertyWizard from './pages/onboarding/PropertyWizard';
  import RegisterTenant from './pages/owner/RegisterTenant'; 
  import WizardSuccess from './pages/onboarding/components/WizardSuccess'; 
  const OwnerDashboard = () => <div>Owner Dashboard</div>; 
  const TenantDashboard = () => <div>Tenant Dashboard</div>; 
  const CaretakerDashboard = () => <div>Caretaker Dashboard</div>; 
  function App() { 
    return ( 
      <Router> 
        <Routes> 
          <Route path="/" element={<Navigate to="/login" replace />} /> 
          <Route path="/login" element={<Login />} /> 
          <Route path="/register" element={<OwnerRegister />} /> 
          <Route path="/setup" element={<PropertyWizard />} /> 
          <Route path="/wizard-success" element={<WizardSuccess />} /> 
          <Route path="/owner/dashboard" element={<OwnerDashboard />} /> 
          <Route path="/tenant/dashboard" element={<TenantDashboard />} /> 
          <Route path="/caretaker/dashboard" element={<CaretakerDashboard />} /> 
          <Route path="/register-sub-user" element={<RegisterTenant />} /> 
          <Route path="/owner/tenants/add" element={<RegisterTenant />} /> 
        </Routes> 
      </Router> 
    ); 
  } 
  export default App;
