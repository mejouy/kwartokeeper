// Philippine regions, provinces, cities and barangays for the address pickers.
//
// Same data and results as the "select-philippines-address" package it replaces
// (that package pulled in an old, vulnerable copy of axios just to download these
// files). Each file is downloaded once per visit and kept in memory. Like the old
// package, a failed download resolves to the error message instead of a list.
const BASE = "https://isaacdarcilla.github.io/philippine-addresses";
const cache = new Map();

function load(name) {
  if (!cache.has(name)) {
    const request = fetch(`${BASE}/${name}.json`).then((res) => {
      if (!res.ok) throw new Error(`Couldn't load the ${name} list (${res.status}).`);
      return res.json();
    });
    // A failed download can be tried again later
    request.catch(() => cache.delete(name));
    cache.set(name, request);
  }
  return cache.get(name);
}

const safely = async (fn) => {
  try {
    return await fn();
  } catch (e) {
    return e.message;
  }
};

export const regions = () =>
  safely(async () => (await load("region")).map(({ id, psgc_code, region_name, region_code }) => ({ id, psgc_code, region_name, region_code })));

export const provinces = (regionCode) =>
  safely(async () =>
    (await load("province"))
      .filter((p) => p.region_code === regionCode)
      .map(({ psgc_code, province_name, province_code, region_code }) => ({ psgc_code, province_name, province_code, region_code }))
  );

export const cities = (provinceCode) =>
  safely(async () =>
    (await load("city"))
      .filter((c) => c.province_code === provinceCode)
      .map(({ city_name, city_code, province_code, region_desc }) => ({ city_name, city_code, province_code, region_desc }))
  );

export const barangays = (cityCode) =>
  safely(async () =>
    (await load("barangay"))
      .filter((b) => b.city_code === cityCode)
      .map(({ brgy_name, brgy_code, province_code, region_code }) => ({ brgy_name, brgy_code, province_code, region_code }))
  );
