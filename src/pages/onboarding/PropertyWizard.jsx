import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Alert, IconButton, Button } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import Step1Basics from './components/Step1Basics';
import Step2Rules from './components/Step2Policies';
import Step3Rooms from './components/Step3Rooms';
import { WizardFooter } from './components/wizardUi';
import { collection, getCountFromServer, query, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../config/firebase';
import { loadPlatformSettings } from '../../utils/platformSettings';

const HEAD = '"Inter", sans-serif';
// Cream page, white cards (same as the owner pages)
const PAGE_BG = (t) => alpha(t.palette.background.paper, 0.35);
const STEPS = [
  { title: 'Basic details', desc: 'Name, address and contact' },
  { title: 'Rules & amenities', desc: 'Floors, curfew and what’s included' },
  { title: 'Rooms & beds', desc: 'Layout, capacity and rates' },
];

// The building lights up as the owner moves through the steps
const COLS = 5;
const ROWS = 6;
const LIGHT_ORDER = [12, 7, 17, 2, 21, 9, 26, 14, 0, 19, 24, 5, 28, 11, 16, 3, 22, 8, 27, 13, 1, 18, 23, 6, 29, 10, 15, 4, 20, 25];

function SetupBuilding({ progress }) {
  const litCount = Math.round(progress * LIGHT_ORDER.length);
  const lit = new Set(LIGHT_ORDER.slice(0, litCount));
  return (
    <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: '10px', maxWidth: 200 }}>
      {Array.from({ length: COLS * ROWS }).map((_, i) => (
        <Box
          key={i}
          sx={{
            aspectRatio: '1',
            borderRadius: '5px',
            bgcolor: lit.has(i) ? '#ff4500' : 'rgba(202,220,246,.14)',
            transition: 'background-color .5s ease',
            transitionDelay: lit.has(i) ? `${(LIGHT_ORDER.indexOf(i) % 10) * 40}ms` : '0ms',
          }}
        />
      ))}
    </Box>
  );
}

function StepList({ activeStep }) {
  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {STEPS.map((s, i) => {
        const done = i < activeStep;
        const active = i === activeStep;
        return (
          <Box
            component="li"
            key={s.title}
            aria-current={active ? 'step' : undefined}
            sx={{
              position: 'relative',
              display: 'flex',
              gap: 1.75,
              pb: i === STEPS.length - 1 ? 0 : 3,
              '&::before': i === STEPS.length - 1 ? undefined : {
                content: '""',
                position: 'absolute',
                left: 15,
                top: 36,
                bottom: 4,
                width: 2,
                borderRadius: 2,
                bgcolor: done ? '#ff4500' : 'rgba(202,220,246,.18)',
              },
            }}
          >
            <Box
              sx={{
                width: 32,
                height: 32,
                flexShrink: 0,
                borderRadius: '10px',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 800,
                fontSize: 14,
                bgcolor: done || active ? '#ff4500' : 'transparent',
                border: '2px solid',
                borderColor: done || active ? '#ff4500' : 'rgba(202,220,246,.28)',
                color: done || active ? '#fff' : '#cadcf6',
              }}
            >
              {done ? <CheckIcon sx={{ fontSize: 18 }} /> : i + 1}
            </Box>
            <Box sx={{ pt: 0.25, minWidth: 0 }}>
              <Typography sx={{ fontWeight: active ? 800 : 600, color: active || done ? '#fff' : '#cadcf6', fontSize: '0.98rem' }}>{s.title}</Typography>
              <Typography sx={{ color: 'rgba(202,220,246,.75)', fontSize: '0.82rem', lineHeight: 1.45 }}>{s.desc}</Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

const PHONE_DIGITS = /^\d{7,13}$/;

export default function PropertyWizard() {
  const navigate = useNavigate();
  // Admin → Settings caps how many properties one owner can add
  const [limit, setLimit] = useState({ blocked: false, max: 0, count: 0 });
  useEffect(() => {
    let active = true;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const [settings, countSnap] = await Promise.all([
          loadPlatformSettings({ fresh: true }),
          getCountFromServer(query(collection(db, 'properties'), where('ownerUid', '==', user.uid))),
        ]);
        const count = countSnap.data().count;
        if (active) setLimit({ blocked: count >= settings.maxPropertiesPerOwner, max: settings.maxPropertiesPerOwner, count });
      } catch (err) {
        console.warn('Could not check the property limit:', err?.code || err);
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});

  const [wizardData, setWizardData] = useState({
    propertyName: '',
    propertyType: 'Dormitory',
    street: '',
    barangay: '',
    cityMunicipality: '',
    province: '',
    region: '',
    regionCode: '',
    provinceCode: '',
    cityCode: '',
    emergencyPhone: '',
    coverPhoto: null,
    coverPhotoUrl: '',
    coverPhotoPreview: '',
    coverPhotoName: '',
    totalFloors: 1,
    amenities: [],
    curfewEnabled: false,
    curfewTime: '10:00 PM',
    rulesText: '',
    rules: [],
    namingPattern: 'floor',
    // Step 3 keeps its layout here when you go back, so nothing is lost
    roomLayout: null,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeStep]);

  // Nothing is saved until the last step, so warn before a refresh or closed tab wipes the form
  const hasWork = Boolean(wizardData.propertyName.trim() || wizardData.street.trim() || wizardData.emergencyPhone.trim());
  useEffect(() => {
    if (!hasWork) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasWork]);

  const leave = () => {
    if (hasWork && !window.confirm('Leave property setup? What you entered will be lost.')) return;
    navigate('/owner', { replace: true });
  };

  const updateWizardData = (newData) => {
    setWizardData((prev) => {
      const updated = { ...prev, ...newData };
      if (newData.totalFloors !== undefined) {
        updated.totalFloors = Math.min(50, Math.max(1, Number(newData.totalFloors) || 1));
      }
      return updated;
    });

    const updatedFields = Object.keys(newData);
    setErrors((prevErrors) => {
      if (!updatedFields.some((f) => prevErrors[f])) return prevErrors;
      const newErrors = { ...prevErrors };
      updatedFields.forEach((field) => delete newErrors[field]);
      return newErrors;
    });
  };

  const validateStep1 = () => {
    const e = {};
    if (!wizardData.propertyName?.trim()) e.propertyName = 'Give your property a name.';
    if (!wizardData.propertyType) e.propertyType = 'Pick a property type.';
    if (!wizardData.regionCode) e.regionCode = 'Select a region.';
    if (!wizardData.provinceCode) e.provinceCode = 'Select a province.';
    if (!wizardData.cityCode) e.cityCode = 'Select a city or municipality.';
    if (!wizardData.barangay) e.barangay = 'Select a barangay.';
    if (!wizardData.street?.trim()) e.street = 'Add the house / building number and street.';
    const phoneDigits = String(wizardData.emergencyPhone || '').replace(/\D/g, '');
    if (!phoneDigits) e.emergencyPhone = 'Add a number tenants can call in an emergency.';
    else if (!PHONE_DIGITS.test(phoneDigits)) e.emergencyPhone = 'Enter a valid phone number (7 to 13 digits).';
    return e;
  };

  const validateStep2 = () => {
    const e = {};
    const floorsNum = Number(wizardData.totalFloors);
    if (!floorsNum || floorsNum < 1) e.totalFloors = 'A property has at least 1 floor.';
    if (wizardData.curfewEnabled && !wizardData.curfewTime) e.curfewTime = 'Pick the curfew time.';
    return e;
  };

  const handleNext = () => {
    const e = activeStep === 0 ? validateStep1() : activeStep === 1 ? validateStep2() : {};
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Bring the first problem into view
      setTimeout(() => {
        const first = document.querySelector('[aria-invalid="true"], [data-error="true"]');
        if (first) {
          first.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof first.focus === 'function') first.focus({ preventScroll: true });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 0);
      return;
    }
    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    if (activeStep === 0) {
      leave();
      return;
    }
    setErrors({});
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const errorCount = Object.keys(errors).length;

  if (limit.blocked) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, bgcolor: PAGE_BG }}>
        <Box sx={{ maxWidth: 440, textAlign: 'center', bgcolor: 'background.default', border: '1px solid', borderColor: 'divider', borderRadius: '22px', p: { xs: 3, sm: 4 } }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 900, fontSize: '1.4rem' }}>You&apos;ve reached the property limit</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Your account can have up to {limit.max} {limit.max === 1 ? 'property' : 'properties'}, and you already have {limit.count}. Contact KwartoKeeper support if you need more.
          </Typography>
          <Button variant="contained" disableElevation onClick={() => navigate('/owner/properties', { replace: true })} sx={{ mt: 3, fontWeight: 700, borderRadius: '10px', minHeight: 44 }}>
            Back to my properties
          </Button>
        </Box>
      </Box>
    );
  }


  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, bgcolor: PAGE_BG }}>
      {/* ───── Desktop: dark side panel ───── */}
      <Box
        component="aside"
        sx={{
          display: { xs: 'none', md: 'flex' },
          flex: '0 0 320px',
          bgcolor: '#202020',
          color: '#fff',
          flexDirection: 'column',
          gap: 5,
          px: 4,
          py: 4.5,
          position: 'sticky',
          top: 0,
          height: '100dvh',
          overflowY: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box component="img" src="/KwartoKeeper-DarkMode-Icon.png" alt="KwartoKeeper" sx={{ height: 30 }} />
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: '1rem', flex: 1 }}>Property setup</Typography>
          <IconButton aria-label="Leave property setup" onClick={leave} size="small" sx={{ color: '#cadcf6', '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,.08)' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <StepList activeStep={activeStep} />

        <Box sx={{ mt: 'auto' }}>
          <SetupBuilding progress={(activeStep + 1) / STEPS.length} />
          <Typography sx={{ color: 'rgba(202,220,246,.75)', fontSize: '0.82rem', mt: 2, lineHeight: 1.5 }}>
            Nothing is saved until the last step. You can change all of this later in Properties.
          </Typography>
        </Box>
      </Box>

      {/* ───── Phones: light top bar with progress ───── */}
      <Box
        component="header"
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'sticky',
          top: 0,
          zIndex: 10,
          px: 2,
          pt: 'calc(10px + env(safe-area-inset-top, 0px))',
          pb: 1.25,
          bgcolor: '#faf7f3',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box component="img" src="/KwartoKeeper-Icon.png" alt="KwartoKeeper" sx={{ height: 26, width: 26, objectFit: 'contain' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>Property setup</Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              Step {activeStep + 1} of {STEPS.length} · {STEPS[activeStep].title}
            </Typography>
          </Box>
          <IconButton aria-label="Leave property setup" onClick={leave} size="small" sx={{ bgcolor: 'action.hover' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, mt: 1.25 }}>
          {STEPS.map((s, i) => (
            <Box key={s.title} sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: i <= activeStep ? 'primary.main' : 'divider', transition: 'background-color .3s' }} />
          ))}
        </Box>
      </Box>

      {/* ───── Step content ───── */}
      <Box component="main" sx={{ flex: 1, minWidth: 0, bgcolor: PAGE_BG, display: 'flex', justifyContent: 'center', px: { xs: 2, sm: 4, md: 6 }, pt: { xs: 3, md: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', minHeight: { md: '100%' } }}>
          {activeStep < 2 && errorCount > 0 && (
            <Alert severity="error" sx={{ mb: 2.5, borderRadius: '14px' }}>
              {errorCount === 1 ? 'One thing needs fixing' : `${errorCount} things need fixing`} before you continue. They're marked below.
            </Alert>
          )}

          <Box sx={{ flex: 1 }}>
            {activeStep === 0 && <Step1Basics wizardData={wizardData} updateWizardData={updateWizardData} errors={errors} />}
            {activeStep === 1 && <Step2Rules wizardData={wizardData} updateWizardData={updateWizardData} errors={errors} />}
            {activeStep === 2 && <Step3Rooms wizardData={wizardData} updateWizardData={updateWizardData} onBack={handleBack} />}
          </Box>

          {activeStep < 2 && (
            <WizardFooter
              onBack={handleBack}
              backLabel={activeStep === 0 ? 'Cancel' : 'Back'}
              primaryLabel={`Next: ${STEPS[activeStep + 1].title}`}
              primaryIcon={<ArrowForwardIcon />}
              onPrimary={handleNext}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
}
