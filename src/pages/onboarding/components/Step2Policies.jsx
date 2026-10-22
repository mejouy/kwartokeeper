import { useState } from 'react';
import { Box, Typography, Switch, TextField, MenuItem, Button, InputAdornment } from '@mui/material';
import { alpha } from '@mui/material/styles';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import WifiIcon from '@mui/icons-material/Wifi';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import SoupKitchenOutlinedIcon from '@mui/icons-material/SoupKitchenOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import LocalLaundryServiceOutlinedIcon from '@mui/icons-material/LocalLaundryServiceOutlined';
import LocalParkingOutlinedIcon from '@mui/icons-material/LocalParkingOutlined';
import HotTubOutlinedIcon from '@mui/icons-material/HotTubOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined';
import NightlightOutlinedIcon from '@mui/icons-material/NightlightOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import { StepHeader, FormCard, Counter } from './wizardUi';

const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

// Same list as the property edit page, so nothing picked here goes missing there
const AMENITIES = [
  { key: 'Wi-Fi', icon: WifiIcon },
  { key: 'Air Conditioning', icon: AcUnitIcon },
  { key: 'CCTV', icon: VideocamOutlinedIcon },
  { key: 'Shared Kitchen', icon: SoupKitchenOutlinedIcon },
  { key: 'Study Area', icon: MenuBookOutlinedIcon },
  { key: 'Laundry Room', icon: LocalLaundryServiceOutlinedIcon },
  { key: 'Parking Space', icon: LocalParkingOutlinedIcon },
  { key: 'Water Heater', icon: HotTubOutlinedIcon },
  { key: '24/7 Security Guard', icon: SecurityOutlinedIcon },
];

// Curfew times every 30 minutes, evening first, in the "10:00 PM" format the tenant
// and caretaker apps read (free text like "10pm weekdays" would switch their curfew features off)
const CURFEW_TIMES = Array.from({ length: 48 }, (_, i) => {
  const mins = (18 * 60 + i * 30) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
});

export const Step2Policies = ({ wizardData = {}, updateWizardData, errors = {} }) => {
  const [customAmenity, setCustomAmenity] = useState('');
  const selected = Array.isArray(wizardData.amenities) ? wizardData.amenities : [];
  const curfewOn = Boolean(wizardData.curfewEnabled);
  const floors = Number(wizardData.totalFloors) || 1;
  const extras = selected.filter((a) => !AMENITIES.some((x) => x.key === a));

  const toggleAmenity = (key) =>
    updateWizardData({ amenities: selected.includes(key) ? selected.filter((a) => a !== key) : [...selected, key] });

  const addCustom = () => {
    const name = customAmenity.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (!selected.some((a) => a.toLowerCase() === name.toLowerCase())) updateWizardData({ amenities: [...selected, name] });
    setCustomAmenity('');
  };

  const setRules = (text) =>
    updateWizardData({
      rulesText: text,
      rules: text.split('\n').map((r) => r.trim()).filter(Boolean),
    });

  const curfewTime = CURFEW_TIMES.includes(wizardData.curfewTime) ? wizardData.curfewTime : '10:00 PM';

  const chip = (key, Icon, on, onClick) => (
    <Box
      key={key}
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={on}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 44,
        px: 1.5,
        font: 'inherit',
        fontSize: 14,
        fontWeight: on ? 700 : 600,
        textAlign: 'left',
        cursor: 'pointer',
        borderRadius: '12px',
        border: '1.5px solid',
        borderColor: on ? 'primary.main' : 'divider',
        bgcolor: (t) => (on ? alpha(t.palette.primary.main, 0.06) : 'transparent'),
        color: on ? 'text.primary' : 'text.secondary',
        transition: 'border-color .15s, background-color .15s',
        '&:hover': { borderColor: on ? 'primary.main' : (t) => alpha(t.palette.text.primary, 0.3) },
      }}
    >
      <Icon sx={{ fontSize: 19, color: on ? 'primary.main' : 'text.disabled' }} />
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{key}</Box>
      <Box sx={{ width: 18, height: 18, borderRadius: '6px', display: 'grid', placeItems: 'center', bgcolor: on ? 'primary.main' : 'transparent', border: on ? 'none' : '1.5px solid', borderColor: 'divider', color: '#fff', flexShrink: 0 }}>
        {on && <CheckIcon sx={{ fontSize: 13 }} />}
      </Box>
    </Box>
  );

  return (
    <Box>
      <StepHeader step={2} total={3} title="Rules and amenities" subtitle="How big the building is, what's included, and the house rules tenants agree to." />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 } }}>
        {/* ───── Floors ───── */}
        <FormCard icon={LayersOutlinedIcon} title="How many floors?" description="Only floors with rooms for rent. You'll set up the rooms on each floor next.">
          <Box data-error={errors.totalFloors ? 'true' : undefined} sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
            <Counter value={floors} onChange={(v) => updateWizardData({ totalFloors: v })} min={1} max={50} label="floors" size="lg" />
            {/* A tiny building that grows with the count */}
            <Box aria-hidden sx={{ display: 'flex', flexDirection: 'column-reverse', gap: '3px' }}>
              {Array.from({ length: Math.min(floors, 8) }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', gap: '3px' }}>
                  {Array.from({ length: 4 }).map((__, j) => (
                    <Box key={j} sx={{ width: 10, height: 10, borderRadius: '2.5px', bgcolor: (i + j) % 3 === 0 ? 'primary.main' : (t) => alpha(t.palette.text.primary, 0.12) }} />
                  ))}
                </Box>
              ))}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {floors === 1 ? '1 floor' : `${floors} floors`}{floors > 8 ? ' (showing 8)' : ''}
            </Typography>
          </Box>
          {errors.totalFloors && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              {errors.totalFloors}
            </Typography>
          )}
        </FormCard>

        {/* ───── Amenities ───── */}
        <FormCard
          icon={StarBorderOutlinedIcon}
          title="What's included?"
          optional
          description="Tap everything tenants get with their rent."
          action={
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700, whiteSpace: 'nowrap', pt: 0.5 }}>
              {selected.length} picked
            </Typography>
          }
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
            {AMENITIES.map(({ key, icon }) => chip(key, icon, selected.includes(key), () => toggleAmenity(key)))}
            {extras.map((key) => chip(key, StarBorderOutlinedIcon, true, () => toggleAmenity(key)))}
          </Box>
          <Box
            component="form"
            onSubmit={(e) => {
              e.preventDefault();
              addCustom();
            }}
            sx={{ display: 'flex', gap: 1, mt: 1.5 }}
          >
            <TextField
              size="small"
              fullWidth
              placeholder="Something else? e.g. Free drinking water"
              value={customAmenity}
              onChange={(e) => setCustomAmenity(e.target.value.slice(0, 40))}
              sx={{ ...fieldSx, maxWidth: 420 }}
            />
            <Button type="submit" variant="outlined" startIcon={<AddIcon />} disabled={!customAmenity.trim()} sx={{ fontWeight: 700, borderRadius: '10px', flexShrink: 0 }}>
              Add
            </Button>
          </Box>
        </FormCard>

        {/* ───── House rules ───── */}
        <FormCard icon={GavelOutlinedIcon} title="House rules" optional description="Tenants see these on their dashboard. You can also upload a signed rules document later in Properties.">
          {/* Curfew */}
          <Box
            data-error={errors.curfewTime ? 'true' : undefined}
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: '14px',
              border: '1.5px solid',
              borderColor: errors.curfewTime ? 'error.main' : curfewOn ? 'primary.main' : 'divider',
              bgcolor: (t) => (curfewOn ? alpha(t.palette.primary.main, 0.04) : 'transparent'),
              transition: 'border-color .15s, background-color .15s',
            }}
          >
            <Box component="label" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '10px', flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: curfewOn ? 'primary.main' : (t) => alpha(t.palette.text.primary, 0.06), color: curfewOn ? '#fff' : 'text.secondary' }}>
                <NightlightOutlinedIcon sx={{ fontSize: 19 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 14.5 }}>Curfew</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4 }}>
                  Caretakers check who's in each night, and tenants get a reminder before it starts.
                </Typography>
              </Box>
              <Switch
                checked={curfewOn}
                onChange={(e) => updateWizardData({ curfewEnabled: e.target.checked, curfewTime: e.target.checked ? curfewTime : wizardData.curfewTime })}
                slotProps={{ input: { 'aria-label': 'Enforce a curfew' } }}
              />
            </Box>
            {curfewOn && (
              <TextField
                select
                label="Curfew starts at"
                value={curfewTime}
                onChange={(e) => updateWizardData({ curfewTime: e.target.value })}
                error={Boolean(errors.curfewTime)}
                helperText={errors.curfewTime}
                sx={{ ...fieldSx, mt: 2, width: { xs: '100%', sm: 240 }, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: 'background.default' } }}
                slotProps={{
                  select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: 320 } } } } },
                  input: { startAdornment: <InputAdornment position="start"><NightlightOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} /></InputAdornment> },
                }}
              >
                {CURFEW_TIMES.map((t) => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          {/* Written rules */}
          <TextField
            label="Other rules"
            placeholder={'One rule per line, e.g.\nNo visitors after 9:00 PM\nKeep common areas clean'}
            value={wizardData.rulesText || ''}
            onChange={(e) => setRules(e.target.value.slice(0, 2000))}
            multiline
            minRows={4}
            fullWidth
            helperText={(wizardData.rules || []).length ? `${(wizardData.rules || []).length} ${(wizardData.rules || []).length === 1 ? 'rule' : 'rules'}` : 'One rule per line.'}
            sx={{ ...fieldSx, mt: 2 }}
          />
        </FormCard>
      </Box>
    </Box>
  );
};

export default Step2Policies;
