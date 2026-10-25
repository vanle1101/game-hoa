export const HOUSING_DISTRICTS = [{ id: "district07", name: "District 07" }] as const;
export const HOUSING_BUILDINGS = [
  { id: "neon-haven", districtId: "district07", name: "Neon Haven" },
  { id: "aurora-tower", districtId: "district07", name: "Aurora Tower" },
  { id: "skyline-residences", districtId: "district07", name: "Skyline Residences" },
] as const;
export const HOUSING_FLOORS = [8, 16, 24] as const;
export const HOUSING_LAYOUTS = [
  { id: "studio", name: "Studio" },
  { id: "one-bedroom", name: "Một phòng ngủ" },
  { id: "open-plan", name: "Không gian mở" },
] as const;
export const STARTER_FURNITURE_IDS = ["cloud-bed", "workstation", "dining-chair", "v7-desktop-tower", "wardrobe", "cyan_floor_light"] as const;
