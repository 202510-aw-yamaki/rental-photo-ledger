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
  recordDate: string;
};

export type FloorPlanSourceType = "pdf" | "image" | "cropped-image";

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FloorPlan = EntityBase & {
  propertyId: string;
  fileName: string;
  fileBlob: Blob;
  pageCount: number;
  sourceType: FloorPlanSourceType;
  mimeType: string;
  naturalWidth: number;
  naturalHeight: number;
  cropRect: CropRect | null;
};

export type FloorPlanPin = EntityBase & {
  propertyId: string;
  floorPlanId: string;
  label: string;
  placeName: string;
  x: number;
  y: number;
};

export type PhotoCategory = string;

export type PhotoRecord = EntityBase & {
  propertyId: string;
  pinId: string;
  targetName: string;
  category: PhotoCategory;
  comment: string;
  imageBlob: Blob;
  imageFileName: string;
  takenAt: ISODateString;
};

export type ChecklistItem = EntityBase & {
  propertyId: string;
  pinId: string;
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
