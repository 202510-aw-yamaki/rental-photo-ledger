export type ISODateString = string;

export type EntityBase = {
  id: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
};

export type Property = EntityBase & {
  name: string;
  address: string;
  moveInDate: string;
  moveOutDate: string;
};

export type FloorPlan = EntityBase & {
  propertyId: string;
  fileName: string;
  fileBlob: Blob;
  pageCount: number;
};

export type FloorPlanPin = EntityBase & {
  propertyId: string;
  floorPlanId: string;
  label: string;
  placeName: string;
  x: number;
  y: number;
};

export type PhotoCategory =
  | "壁"
  | "床"
  | "天井"
  | "ドア"
  | "窓"
  | "収納"
  | "キッチン"
  | "浴室"
  | "洗面"
  | "トイレ"
  | "水回り"
  | "エアコン"
  | "電気設備"
  | "備え付け設備"
  | "ベランダ"
  | "その他";

export type PhotoRecord = EntityBase & {
  propertyId: string;
  pinId: string;
  category: PhotoCategory;
  comment: string;
  imageBlob: Blob;
  imageFileName: string;
  takenAt: ISODateString;
};

export type ChecklistItem = EntityBase & {
  propertyId: string;
  room: string;
  label: string;
  isChecked: boolean;
  note: string;
};

export type ExportHistory = {
  id: string;
  propertyId: string;
  fileName: string;
  exportedAt: ISODateString;
};

export type PropertyBundle = {
  floorPlan: FloorPlan | null;
  pins: FloorPlanPin[];
  photos: PhotoRecord[];
  checklistItems: ChecklistItem[];
  exportHistory: ExportHistory[];
};
