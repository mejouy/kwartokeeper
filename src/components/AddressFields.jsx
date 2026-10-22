// Philippine address picker: Region → Province → City / Municipality →
// Barangay dropdowns (same data as the property registration wizard), plus
// the street line.
//
// `value` holds the names (what is shown and saved) and, when known, the PSGC
// codes. Older records only have names, so the codes are looked up from the
// names when the form opens. That lookup stays inside this component, so just
// opening the form never counts as an unsaved change.
import { useEffect, useState } from "react";
import { Box, TextField, MenuItem, CircularProgress, InputAdornment } from "@mui/material";
import { regions, provinces, cities, barangays } from "select-philippines-address";

// The package returns an error message string instead of a list on failure
const asList = (res) => (Array.isArray(res) ? res : []);
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const findCode = (list, nameKey, codeKey, name) => {
  const target = norm(name);
  if (!target) return "";
  return String(list.find((item) => norm(item[nameKey]) === target)?.[codeKey] || "");
};

// `errors` (optional) is keyed regionCode / provinceCode / cityCode / barangay / street
export default function AddressFields({ value, onChange, fieldSx, columns, errors = {} }) {
  // name -> list caches, so going back and forth never refetches
  const [regionList, setRegionList] = useState(null);
  const [provinceLists, setProvinceLists] = useState({});
  const [cityLists, setCityLists] = useState({});
  const [barangayLists, setBarangayLists] = useState({});
  const [loadFailed, setLoadFailed] = useState(false);

  // Codes resolved from saved names (only used when the record has no codes)
  const [resolved, setResolved] = useState({ regionCode: "", provinceCode: "", cityCode: "" });

  const regionCode = value.regionCode || resolved.regionCode;
  const provinceCode = value.provinceCode || resolved.provinceCode;
  const cityCode = value.cityCode || resolved.cityCode;

  useEffect(() => {
    let alive = true;
    regions()
      .then((res) => {
        if (!alive) return;
        const list = asList(res);
        if (!list.length) setLoadFailed(true);
        setRegionList(list);
        if (!value.regionCode && value.region) {
          setResolved((r) => ({ ...r, regionCode: findCode(list, "region_name", "region_code", value.region) }));
        }
      })
      .catch(() => alive && setLoadFailed(true));
    return () => {
      alive = false;
    };
    // only on open; later changes come through the handlers below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!regionCode || provinceLists[regionCode]) return undefined;
    let alive = true;
    provinces(regionCode).then((res) => {
      if (!alive) return;
      const list = asList(res);
      setProvinceLists((m) => ({ ...m, [regionCode]: list }));
      if (!value.provinceCode && value.province) {
        setResolved((r) => ({ ...r, provinceCode: findCode(list, "province_name", "province_code", value.province) }));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionCode]);

  useEffect(() => {
    if (!provinceCode || cityLists[provinceCode]) return undefined;
    let alive = true;
    cities(provinceCode).then((res) => {
      if (!alive) return;
      const list = asList(res);
      setCityLists((m) => ({ ...m, [provinceCode]: list }));
      if (!value.cityCode && value.cityMunicipality) {
        setResolved((r) => ({ ...r, cityCode: findCode(list, "city_name", "city_code", value.cityMunicipality) }));
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinceCode]);

  useEffect(() => {
    if (!cityCode || barangayLists[cityCode]) return undefined;
    let alive = true;
    barangays(cityCode).then((res) => {
      if (alive) setBarangayLists((m) => ({ ...m, [cityCode]: asList(res) }));
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityCode]);

  const provinceList = provinceLists[regionCode] || [];
  const cityList = cityLists[provinceCode] || [];
  const barangayList = barangayLists[cityCode] || [];

  // A saved name that isn't in the list (typo, renamed place) stays visible as
  // its own option instead of the field going blank.
  const barangayOptions = value.barangay && !barangayList.some((b) => b.brgy_name === value.barangay)
    ? [{ brgy_code: "__saved__", brgy_name: value.barangay }, ...barangayList]
    : barangayList;

  const loading = (list, parentCode) => Boolean(parentCode) && !list;
  const spinner = (busy) =>
    busy ? { input: { endAdornment: <InputAdornment position="end" sx={{ mr: 2 }}><CircularProgress size={16} /></InputAdornment> } } : undefined;

  const handleRegion = (e) => {
    const code = String(e.target.value);
    setResolved({ regionCode: "", provinceCode: "", cityCode: "" });
    onChange({
      region: regionList?.find((r) => String(r.region_code) === code)?.region_name || "",
      regionCode: code,
      province: "",
      provinceCode: "",
      cityMunicipality: "",
      cityCode: "",
      barangay: "",
    });
  };

  const handleProvince = (e) => {
    const code = String(e.target.value);
    setResolved((r) => ({ ...r, provinceCode: "", cityCode: "" }));
    onChange({
      regionCode,
      province: provinceList.find((p) => String(p.province_code) === code)?.province_name || "",
      provinceCode: code,
      cityMunicipality: "",
      cityCode: "",
      barangay: "",
    });
  };

  const handleCity = (e) => {
    const code = String(e.target.value);
    setResolved((r) => ({ ...r, cityCode: "" }));
    onChange({
      regionCode,
      provinceCode,
      cityMunicipality: cityList.find((c) => String(c.city_code) === code)?.city_name || "",
      cityCode: code,
      barangay: "",
    });
  };

  const handleBarangay = (e) => onChange({ regionCode, provinceCode, cityCode, barangay: e.target.value });

  // Shown under a dropdown whose saved name couldn't be matched to the list
  const unmatched = (code, name) => (!code && name ? `Saved as "${name}". Pick it from the list to update.` : undefined);

  const grid = { display: "grid", gridTemplateColumns: columns || { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Box sx={grid}>
        <TextField
          select
          fullWidth
          label="Region"
          value={regionList && regionCode ? regionCode : ""}
          onChange={handleRegion}
          disabled={!regionList?.length}
          helperText={loadFailed ? "Couldn't load the address list. Check your connection." : errors.regionCode || (regionList ? unmatched(regionCode, value.region) : undefined)}
          error={loadFailed || Boolean(errors.regionCode)}
          sx={fieldSx}
          slotProps={spinner(!regionList && !loadFailed)}
        >
          {(regionList || []).map((r) => (
            <MenuItem key={r.region_code} value={String(r.region_code)}>{r.region_name}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Province"
          value={provinceList.length && provinceCode ? provinceCode : ""}
          onChange={handleProvince}
          disabled={!regionCode || !provinceList.length}
          helperText={errors.provinceCode || (provinceList.length ? unmatched(provinceCode, value.province) : undefined)}
          error={Boolean(errors.provinceCode)}
          sx={fieldSx}
          slotProps={spinner(loading(provinceLists[regionCode], regionCode))}
        >
          {provinceList.map((p) => (
            <MenuItem key={p.province_code} value={String(p.province_code)}>{p.province_name}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="City / municipality"
          value={cityList.length && cityCode ? cityCode : ""}
          onChange={handleCity}
          disabled={!provinceCode || !cityList.length}
          helperText={errors.cityCode || (cityList.length ? unmatched(cityCode, value.cityMunicipality) : undefined)}
          error={Boolean(errors.cityCode)}
          sx={fieldSx}
          slotProps={spinner(loading(cityLists[provinceCode], provinceCode))}
        >
          {cityList.map((c) => (
            <MenuItem key={c.city_code} value={String(c.city_code)}>{c.city_name}</MenuItem>
          ))}
        </TextField>

        <TextField
          select
          fullWidth
          label="Barangay"
          value={barangayOptions.length ? value.barangay || "" : ""}
          onChange={handleBarangay}
          disabled={!cityCode || !barangayOptions.length}
          error={Boolean(errors.barangay)}
          helperText={errors.barangay}
          sx={fieldSx}
          slotProps={spinner(loading(barangayLists[cityCode], cityCode))}
        >
          {barangayOptions.map((b) => (
            <MenuItem key={b.brgy_code} value={b.brgy_name}>{b.brgy_name}</MenuItem>
          ))}
        </TextField>
      </Box>

      <TextField
        fullWidth
        label="Street / building no."
        placeholder="House/bldg no., street, subdivision"
        value={value.street || ""}
        onChange={(e) => onChange({ street: e.target.value })}
        error={Boolean(errors.street)}
        helperText={errors.street}
        sx={fieldSx}
      />
    </Box>
  );
}
