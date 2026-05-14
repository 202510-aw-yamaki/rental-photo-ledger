import Dexie, { type Table } from "dexie";
import { DEFAULT_PIN_CHECKLIST_ITEMS, PHOTO_CATEGORIES } from "./constants";
import { getLocalDateInputValue } from "./lib/dates";
import type {
  ChecklistItem,
  ExportHistory,
  FloorPlan,
  FloorPlanPin,
  PhotoCategory,
  PhotoRecord,
  Property,
  PropertyBundle
} from "./types";

export const createId = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;

const nowIso = () => new Date().toISOString();

class LedgerDatabase extends Dexie {
  properties!: Table<Property, string>;
  floorPlans!: Table<FloorPlan, string>;
  floorPlanPins!: Table<FloorPlanPin, string>;
  photoRecords!: Table<PhotoRecord, string>;
  checklistItems!: Table<ChecklistItem, string>;
  exportHistory!: Table<ExportHistory, string>;

  constructor() {
    super("rental-photo-ledger");
    const stores = {
      properties: "id, name, updatedAt",
      floorPlans: "id, propertyId, updatedAt",
      floorPlanPins: "id, propertyId, floorPlanId, label, updatedAt",
      photoRecords: "id, propertyId, pinId, takenAt, updatedAt",
      checklistItems: "id, propertyId, pinId, room, isChecked, updatedAt",
      exportHistory: "id, propertyId, exportedAt"
    };

    this.version(1).stores({
      ...stores,
      checklistItems: "id, propertyId, room, isChecked, updatedAt"
    });
    this.version(2)
      .stores(stores)
      .upgrade(async (transaction) => {
        await transaction
          .table("photoRecords")
          .toCollection()
          .modify((photo) => {
            photo.targetName = photo.targetName ?? "";
          });
        await transaction
          .table("checklistItems")
          .toCollection()
          .modify((item) => {
            item.pinId = item.pinId ?? "";
            item.note = item.note ?? "";
          });
      });
  }
}

export const db = new LedgerDatabase();

const makePinChecklistItems = (pin: FloorPlanPin, timestamp = nowIso()): ChecklistItem[] =>
  DEFAULT_PIN_CHECKLIST_ITEMS.map((label) => ({
    id: createId("check"),
    propertyId: pin.propertyId,
    pinId: pin.id,
    room: `ピン ${pin.label}`,
    label,
    isChecked: false,
    note: "",
    createdAt: timestamp,
    updatedAt: timestamp
  }));

export async function createProperty(input: {
  name: string;
  moveInDate: string;
  moveOutDate?: string;
}): Promise<Property> {
  const timestamp = nowIso();
  const property: Property = {
    id: createId("property"),
    name: input.name.trim(),
    address: "",
    moveInDate: input.moveInDate,
    moveOutDate: input.moveOutDate ?? "",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.properties.add(property);

  return property;
}

export async function createSampleProperty(): Promise<Property> {
  const today = getLocalDateInputValue();
  return createProperty({
    name: "サンプル物件",
    moveInDate: today
  });
}

export async function listProperties(): Promise<Property[]> {
  return db.properties.orderBy("updatedAt").reverse().toArray();
}

export async function deleteProperty(propertyId: string): Promise<void> {
  await db.transaction(
    "rw",
    [db.properties, db.floorPlans, db.floorPlanPins, db.photoRecords, db.checklistItems, db.exportHistory],
    async () => {
      await db.properties.delete(propertyId);
      await db.floorPlans.where("propertyId").equals(propertyId).delete();
      await db.floorPlanPins.where("propertyId").equals(propertyId).delete();
      await db.photoRecords.where("propertyId").equals(propertyId).delete();
      await db.checklistItems.where("propertyId").equals(propertyId).delete();
      await db.exportHistory.where("propertyId").equals(propertyId).delete();
    }
  );
}

export async function touchProperty(propertyId: string): Promise<void> {
  await db.properties.update(propertyId, { updatedAt: nowIso() });
}

export async function loadPropertyBundle(propertyId: string): Promise<PropertyBundle> {
  const [floorPlans, pins, photos, initialChecklistItems, exportHistory] = await Promise.all([
    db.floorPlans.where("propertyId").equals(propertyId).reverse().sortBy("updatedAt"),
    db.floorPlanPins.where("propertyId").equals(propertyId).sortBy("label"),
    db.photoRecords.where("propertyId").equals(propertyId).reverse().sortBy("takenAt"),
    db.checklistItems.where("propertyId").equals(propertyId).sortBy("room"),
    db.exportHistory.where("propertyId").equals(propertyId).reverse().sortBy("exportedAt")
  ]);
  let checklistItems = initialChecklistItems;
  const pinsWithChecklist = new Set(checklistItems.filter((item) => item.pinId).map((item) => item.pinId));
  const pinsWithoutChecklist = pins.filter((pin) => !pinsWithChecklist.has(pin.id));

  if (pinsWithoutChecklist.length > 0) {
    const timestamp = nowIso();
    await db.checklistItems.bulkAdd(pinsWithoutChecklist.flatMap((pin) => makePinChecklistItems(pin, timestamp)));
    checklistItems = await db.checklistItems.where("propertyId").equals(propertyId).sortBy("room");
  }

  return {
    floorPlan: floorPlans.at(0) ?? null,
    pins: pins.sort((a, b) => Number(a.label) - Number(b.label)),
    photos,
    checklistItems,
    exportHistory
  };
}

export async function saveFloorPlan(input: {
  propertyId: string;
  fileName: string;
  fileBlob: Blob;
  pageCount: number;
}): Promise<FloorPlan> {
  const timestamp = nowIso();
  const floorPlan: FloorPlan = {
    id: createId("floor"),
    propertyId: input.propertyId,
    fileName: input.fileName,
    fileBlob: input.fileBlob,
    pageCount: input.pageCount,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.transaction("rw", db.properties, db.floorPlans, db.floorPlanPins, async () => {
    await db.floorPlans.where("propertyId").equals(input.propertyId).delete();
    await db.floorPlans.add(floorPlan);
    await db.floorPlanPins.where("propertyId").equals(input.propertyId).modify({
      floorPlanId: floorPlan.id,
      updatedAt: timestamp
    });
    await touchProperty(input.propertyId);
  });

  return floorPlan;
}

export async function addPin(input: {
  propertyId: string;
  floorPlanId: string;
  label: string;
  x: number;
  y: number;
}): Promise<FloorPlanPin> {
  const timestamp = nowIso();
  const pin: FloorPlanPin = {
    id: createId("pin"),
    propertyId: input.propertyId,
    floorPlanId: input.floorPlanId,
    label: input.label,
    placeName: "",
    x: clampNormalized(input.x),
    y: clampNormalized(input.y),
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.transaction("rw", db.properties, db.floorPlanPins, db.checklistItems, async () => {
    await db.floorPlanPins.add(pin);
    await db.checklistItems.bulkAdd(makePinChecklistItems(pin, timestamp));
    await touchProperty(input.propertyId);
  });

  return pin;
}

export async function updatePin(pinId: string, patch: Partial<Pick<FloorPlanPin, "placeName" | "x" | "y">>): Promise<void> {
  const existing = await db.floorPlanPins.get(pinId);
  if (!existing) return;

  await db.transaction("rw", db.properties, db.floorPlanPins, async () => {
    await db.floorPlanPins.update(pinId, {
      ...patch,
      x: patch.x === undefined ? existing.x : clampNormalized(patch.x),
      y: patch.y === undefined ? existing.y : clampNormalized(patch.y),
      updatedAt: nowIso()
    });
    await touchProperty(existing.propertyId);
  });
}

export async function deletePin(pinId: string): Promise<void> {
  const existing = await db.floorPlanPins.get(pinId);
  if (!existing) return;

  await db.transaction("rw", db.properties, db.floorPlanPins, db.photoRecords, db.checklistItems, async () => {
    await db.floorPlanPins.delete(pinId);
    await db.photoRecords.where("pinId").equals(pinId).delete();
    await db.checklistItems.where("pinId").equals(pinId).delete();
    await touchProperty(existing.propertyId);
  });
}

export async function addPhotoRecord(input: {
  propertyId: string;
  pinId: string;
  targetName: string;
  category: PhotoCategory;
  comment: string;
  imageBlob: Blob;
  imageFileName: string;
}): Promise<PhotoRecord> {
  const timestamp = nowIso();
  const photo: PhotoRecord = {
    id: createId("photo"),
    propertyId: input.propertyId,
    pinId: input.pinId,
    targetName: input.targetName.trim(),
    category: PHOTO_CATEGORIES.includes(input.category) ? input.category : "その他",
    comment: input.comment.trim(),
    imageBlob: input.imageBlob,
    imageFileName: input.imageFileName,
    takenAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  await db.transaction("rw", db.properties, db.photoRecords, async () => {
    await db.photoRecords.add(photo);
    await touchProperty(input.propertyId);
  });

  return photo;
}

export async function deletePhotoRecord(photoId: string): Promise<void> {
  const existing = await db.photoRecords.get(photoId);
  if (!existing) return;

  await db.transaction("rw", db.properties, db.photoRecords, async () => {
    await db.photoRecords.delete(photoId);
    await touchProperty(existing.propertyId);
  });
}

export async function updateChecklistItem(
  itemId: string,
  patch: Partial<Pick<ChecklistItem, "isChecked" | "note">>
): Promise<void> {
  const existing = await db.checklistItems.get(itemId);
  if (!existing) return;

  await db.transaction("rw", db.properties, db.checklistItems, async () => {
    await db.checklistItems.update(itemId, {
      ...patch,
      updatedAt: nowIso()
    });
    await touchProperty(existing.propertyId);
  });
}

export async function addExportHistory(propertyId: string, fileName: string): Promise<ExportHistory> {
  const history: ExportHistory = {
    id: createId("export"),
    propertyId,
    fileName,
    exportedAt: nowIso()
  };

  await db.exportHistory.add(history);
  await touchProperty(propertyId);
  return history;
}

const clampNormalized = (value: number) => Math.min(1, Math.max(0, value));
