import { addPin, createProperty, saveFloorPlan, updatePin } from "../db";
import type { Property } from "../types";
import { generateSampleLayoutPdf, getSampleLayout, type SampleLayoutType } from "./sampleLayouts";

export async function createSamplePropertyWithLayout(type: SampleLayoutType): Promise<Property> {
  const layout = getSampleLayout(type);
  const today = new Date().toISOString().slice(0, 10);
  const property = await createProperty({
    name: layout.propertyName,
    moveInDate: today
  });
  const fileBlob = await generateSampleLayoutPdf(type);
  const floorPlan = await saveFloorPlan({
    propertyId: property.id,
    fileName: layout.fileName,
    fileBlob,
    pageCount: 1
  });

  for (const seed of layout.pins) {
    const pin = await addPin({
      propertyId: property.id,
      floorPlanId: floorPlan.id,
      label: seed.label,
      x: seed.x,
      y: seed.y
    });
    await updatePin(pin.id, { placeName: seed.placeName });
  }

  return property;
}
