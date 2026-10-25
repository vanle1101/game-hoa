export type HousingFloor = 8 | 16 | 24;
export type HousingLayoutId = "studio" | "one-bedroom" | "open-plan";
export interface HousingSelection {
  districtId: "district07";
  buildingId: string;
  floor: HousingFloor;
  layoutId: HousingLayoutId;
}
export interface Residence extends HousingSelection { completedAt: string; }
export type HousingAction = { type: "housing.settle" } & HousingSelection;
