import { useState } from 'react';
import { Box, Typography, TextField, Button, InputAdornment, CircularProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ApartmentOutlinedIcon from '@mui/icons-material/ApartmentOutlined';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import BedOutlinedIcon from '@mui/icons-material/BedOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AddressFields from '../../../components/AddressFields';
import { StepHeader, FormCard, ChoiceTile } from './wizardUi';

const MAX_PHOTO_MB = 10;
const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '10px' } };

const PROPERTY_TYPES = [
  { value: 'Dormitory', hint: 'Shared rooms or bedspaces', icon: ApartmentOutlinedIcon },
  { value: 'Apartment', hint: 'Self-contained units', icon: HomeWorkOutlinedIcon },
  { value: 'Boarding House', label: 'Boarding house', hint: 'Rooms in a house', icon: BedOutlinedIcon },
];

// Shrinks big phone photos before preview (the original file is still what gets uploaded)
const compressImage = (file, maxWidth = 1000, maxHeight = 1000, quality = 0.75) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else if (height >= width && height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

const readAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function Step1Basics({ wizardData = {}, updateWizardData, errors = {} }) {
  const [processing, setProcessing] = useState(false);
  const [photoError, setPhotoError] = useState('');

  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose a photo (JPG or PNG).');
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoError(`That photo is over ${MAX_PHOTO_MB} MB. Please choose a smaller one.`);
      return;
    }
    setPhotoError('');
    setProcessing(true);
    try {
      let preview;
      try {
        preview = await compressImage(file);
      } catch (err) {
        console.warn('Photo compression failed, using the original for the preview:', err);
        preview = await readAsDataUrl(file);
      }
      updateWizardData({ coverPhotoName: file.name, coverPhotoPreview: preview, coverPhotoUrl: '', coverPhoto: file });
    } catch (err) {
      console.error('Could not read the photo:', err);
      setPhotoError("Couldn't read that photo. Try another one.");
    } finally {
      setProcessing(false);
    }
  };

  const removePhoto = () => updateWizardData({ coverPhotoName: '', coverPhotoPreview: '', coverPhotoUrl: '', coverPhoto: null });

  const photoSrc = wizardData.coverPhotoPreview || wizardData.coverPhotoUrl || (typeof wizardData.coverPhoto === 'string' ? wizardData.coverPhoto : '');
  const nameLen = (wizardData.propertyName || '').length;

  return (
    <Box>
      <StepHeader step={1} total={3} title="Tell us about your property" subtitle="The basics tenants and caretakers will see, and that show up on your reports." />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 } }}>
        {/* ───── Name & type ───── */}
        <FormCard icon={BadgeOutlinedIcon} title="Name and type">
          <TextField
            fullWidth
            label="Property name"
            placeholder="e.g. Casa Bonifacio Dormitory"
            value={wizardData.propertyName || ''}
            onChange={(e) => updateWizardData({ propertyName: e.target.value.slice(0, 80) })}
            error={Boolean(errors.propertyName)}
            helperText={errors.propertyName || `${nameLen}/80`}
            autoFocus
            sx={fieldSx}
          />
          <Typography variant="body2" sx={{ fontWeight: 700, mt: 2.5, mb: 1 }}>
            What kind of property is it?
          </Typography>
          <Box data-error={errors.propertyType ? 'true' : undefined} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
            {PROPERTY_TYPES.map((t) => (
              <ChoiceTile
                key={t.value}
                active={wizardData.propertyType === t.value}
                onClick={() => updateWizardData({ propertyType: t.value })}
                icon={t.icon}
                title={t.label || t.value}
                hint={t.hint}
              />
            ))}
          </Box>
          {errors.propertyType && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.75 }}>
              {errors.propertyType}
            </Typography>
          )}
        </FormCard>

        {/* ───── Address ───── */}
        <FormCard icon={LocationOnOutlinedIcon} title="Where is it?" description="Pick from the lists so the address is spelled the same everywhere." error={['regionCode', 'provinceCode', 'cityCode', 'barangay', 'street'].some((k) => errors[k])}>
          <AddressFields value={wizardData} onChange={updateWizardData} fieldSx={fieldSx} errors={errors} />
        </FormCard>

        {/* ───── Contact ───── */}
        <FormCard icon={PhoneOutlinedIcon} title="Emergency contact" description="A desk or caretaker number tenants can call any time.">
          <TextField
            fullWidth
            label="Phone number"
            placeholder="09171234567"
            value={wizardData.emergencyPhone || ''}
            onChange={(e) => updateWizardData({ emergencyPhone: e.target.value.replace(/[^0-9]/g, '') })}
            error={Boolean(errors.emergencyPhone)}
            helperText={errors.emergencyPhone || 'Mobile or landline, numbers only.'}
            autoComplete="tel"
            sx={{ ...fieldSx, maxWidth: { sm: 360 } }}
            slotProps={{
              htmlInput: { maxLength: 13, inputMode: 'tel' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <PhoneOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </FormCard>

        {/* ───── Cover photo ───── */}
        <FormCard icon={ImageOutlinedIcon} title="Cover photo" optional description="The first thing tenants see. A photo of the front of the building works best.">
          {photoSrc ? (
            <Box sx={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
              <Box component="img" src={photoSrc} alt="Cover photo preview" sx={{ display: 'block', width: '100%', aspectRatio: '16 / 7', objectFit: 'cover', bgcolor: 'action.hover' }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                  {wizardData.coverPhotoName || 'Cover photo'}
                </Typography>
                <Button component="label" size="small" disabled={processing} sx={{ fontWeight: 700 }}>
                  Replace
                  <input type="file" hidden accept="image/*" onChange={handlePhotoPick} />
                </Button>
                <Button size="small" color="inherit" onClick={removePhoto} sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Remove
                </Button>
              </Box>
            </Box>
          ) : (
            <Box
              component="label"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                py: { xs: 4, sm: 5 },
                px: 2,
                textAlign: 'center',
                cursor: processing ? 'wait' : 'pointer',
                borderRadius: '14px',
                border: '1.5px dashed',
                borderColor: photoError ? 'error.main' : 'divider',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.4),
                transition: 'border-color .15s, background-color .15s',
                '&:hover': { borderColor: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.03) },
              }}
            >
              {processing ? <CircularProgress size={28} /> : <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 34, color: 'primary.main' }} />}
              <Typography sx={{ fontWeight: 800 }}>{processing ? 'Preparing photo…' : 'Add a cover photo'}</Typography>
              <Typography variant="caption" color="text.secondary">
                JPG or PNG, up to {MAX_PHOTO_MB} MB · you can add one later too
              </Typography>
              <input type="file" hidden accept="image/*" onChange={handlePhotoPick} disabled={processing} />
            </Box>
          )}
          {photoError && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
              {photoError}
            </Typography>
          )}
        </FormCard>
      </Box>
    </Box>
  );
}
