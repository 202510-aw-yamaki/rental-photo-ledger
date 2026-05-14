import {
  ArrowLeft,
  Camera,
  Check,
  Download,
  Edit3,
  Eye,
  FileText,
  Home,
  Image as ImageIcon,
  MapPin,
  Move,
  Plus,
  Save,
  Share2,
  Trash2,
  Upload
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addExportHistory,
  addPhotoRecord,
  addPin,
  createProperty,
  deletePhotoRecord,
  deletePin,
  deleteProperty,
  listProperties,
  loadPropertyBundle,
  saveFloorPlan,
  updatePin
} from "./db";
import { getLocalDateInputValue } from "./lib/dates";
import {
  cropCanvasToPngBlob,
  normalizeCropRect,
  renderFloorPlan,
  renderUploadSource,
  type SourcePreview
} from "./lib/floorPlanPreview";
import { compressImage } from "./lib/images";
import { buildLedgerFileName, formatDateTime, generateLedgerPdf } from "./lib/ledgerPdf";
import { createSamplePropertyWithLayout } from "./lib/sampleData";
import { SAMPLE_LAYOUTS, type SampleLayoutType } from "./lib/sampleLayouts";
import {
  APP_NAME,
  APP_NOTICE,
  PHOTO_CATEGORIES,
  SHARE_MAIL_BODY,
  SHARE_MAIL_SUBJECT
} from "./mvpConstants";
import type { CropRect, FloorPlan, FloorPlanPin, PhotoCategory, PhotoRecord, Property, PropertyBundle } from "./types";

type AppView = "home" | "create" | "review" | "detail";
type CreateStep = "info" | "floor" | "pins" | "photos" | "finish";
type MapMode = "select" | "add" | "move";

const emptyBundle: PropertyBundle = {
  floorPlan: null,
  pins: [],
  photos: [],
  checklistItems: [],
  exportHistory: []
};

const createSteps: Array<{ id: CreateStep; label: string }> = [
  { id: "info", label: "部屋情報" },
  { id: "floor", label: "間取り" },
  { id: "pins", label: "ピン" },
  { id: "photos", label: "写真" },
  { id: "finish", label: "保存" }
];

export function ConsumerAppShell() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [bundle, setBundle] = useState<PropertyBundle>(emptyBundle);
  const [view, setView] = useState<AppView>("home");
  const [createStep, setCreateStep] = useState<CreateStep>("info");
  const [selectedPinId, setSelectedPinId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? null;

  const refreshProperties = useCallback(async () => {
    const nextProperties = await listProperties();
    setProperties(nextProperties);
    return nextProperties;
  }, []);

  const refreshBundle = useCallback(async (propertyId: string) => {
    if (!propertyId) {
      setBundle(emptyBundle);
      return emptyBundle;
    }
    const nextBundle = await loadPropertyBundle(propertyId);
    setBundle(nextBundle);
    return nextBundle;
  }, []);

  const reloadAll = useCallback(
    async (propertyId = selectedPropertyId) => {
      await refreshProperties();
      if (propertyId) {
        await refreshBundle(propertyId);
      }
    },
    [refreshBundle, refreshProperties, selectedPropertyId]
  );

  useEffect(() => {
    void refreshProperties();
  }, [refreshProperties]);

  useEffect(() => {
    void refreshBundle(selectedPropertyId);
  }, [refreshBundle, selectedPropertyId]);

  useEffect(() => {
    setSelectedPinId((current) => {
      if (current && bundle.pins.some((pin) => pin.id === current)) return current;
      return bundle.pins.at(0)?.id ?? "";
    });
  }, [bundle.pins]);

  const runAction = async (action: () => Promise<void>, successMessage?: string) => {
    setBusy(true);
    setMessage("");
    try {
      await action();
      if (successMessage) setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "処理に失敗しました。");
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => {
    setSelectedPropertyId("");
    setBundle(emptyBundle);
    setSelectedPinId("");
    setCreateStep("info");
    setView("create");
    setMessage("");
  };

  const openReview = () => {
    setView("review");
    setMessage("");
  };

  const openDetail = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setView("detail");
    setMessage("");
  };

  const startEdit = () => {
    setCreateStep(bundle.floorPlan ? "pins" : "floor");
    setView("create");
    setMessage("");
  };

  const handleCreateRecord = async (input: { name: string; moveInDate: string; recordDate: string }) => {
    await runAction(async () => {
      const property = await createProperty({
        name: input.name,
        moveInDate: input.moveInDate,
        recordDate: input.recordDate
      });
      setSelectedPropertyId(property.id);
      await reloadAll(property.id);
      setCreateStep("floor");
    }, "部屋情報を作成しました。続けて間取りを読み込んでください。");
  };

  const handleSaveFloorPlan = async (input: {
    fileName: string;
    blob: Blob;
    pageCount: number;
    naturalWidth: number;
    naturalHeight: number;
    cropRect: CropRect;
  }) => {
    if (!selectedProperty) return;
    if (bundle.floorPlan && (bundle.pins.length > 0 || bundle.photos.length > 0)) {
      const ok = window.confirm(
        "間取りを差し替えます。既存のピンと写真は残りますが、ピン位置の見直しが必要になる場合があります。"
      );
      if (!ok) return;
    }

    await runAction(async () => {
      await saveFloorPlan({
        propertyId: selectedProperty.id,
        fileName: input.fileName,
        fileBlob: input.blob,
        pageCount: input.pageCount,
        sourceType: "cropped-image",
        mimeType: "image/png",
        naturalWidth: input.naturalWidth,
        naturalHeight: input.naturalHeight,
        cropRect: input.cropRect
      });
      await reloadAll(selectedProperty.id);
      setCreateStep("pins");
    }, "切り抜いた間取りを保存しました。");
  };

  const handleAddPin = async (point: { x: number; y: number }) => {
    if (!selectedProperty || !bundle.floorPlan) return;
    await runAction(async () => {
      const currentMax = Math.max(0, ...bundle.pins.map((pin) => Number(pin.label)).filter(Number.isFinite));
      const pin = await addPin({
        propertyId: selectedProperty.id,
        floorPlanId: bundle.floorPlan!.id,
        label: String(currentMax + 1),
        x: point.x,
        y: point.y
      });
      setSelectedPinId(pin.id);
      await reloadAll(selectedProperty.id);
    }, "ピンを追加しました。");
  };

  const handleMovePin = async (pinId: string, point: { x: number; y: number }) => {
    if (!selectedProperty) return;
    await runAction(async () => {
      await updatePin(pinId, point);
      await reloadAll(selectedProperty.id);
    }, "ピンを移動しました。");
  };

  const handleUpdatePinName = async (pinId: string, placeName: string) => {
    if (!selectedProperty) return;
    await runAction(async () => {
      await updatePin(pinId, { placeName });
      await reloadAll(selectedProperty.id);
    }, "場所名を保存しました。");
  };

  const handleDeletePin = async (pinId: string) => {
    if (!selectedProperty) return;
    const ok = window.confirm("このピンと、このピンに登録した写真を削除します。");
    if (!ok) return;
    await runAction(async () => {
      await deletePin(pinId);
      await reloadAll(selectedProperty.id);
    }, "ピンを削除しました。");
  };

  const handleAddPhoto = async (input: {
    pinId: string;
    file: File;
    targetName: string;
    category: PhotoCategory;
    comment: string;
  }) => {
    if (!selectedProperty) return;
    await runAction(async () => {
      const imageBlob = await compressImage(input.file);
      await addPhotoRecord({
        propertyId: selectedProperty.id,
        pinId: input.pinId,
        targetName: input.targetName,
        category: input.category,
        comment: input.comment,
        imageBlob,
        imageFileName: input.file.name
      });
      await reloadAll(selectedProperty.id);
    }, "写真を追加しました。");
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!selectedProperty) return;
    await runAction(async () => {
      await deletePhotoRecord(photoId);
      await reloadAll(selectedProperty.id);
    }, "写真を削除しました。");
  };

  const handleDeleteProperty = async () => {
    if (!selectedProperty) return;
    const ok = window.confirm("この記録を削除します。間取り、ピン、写真、PDF出力履歴も削除されます。");
    if (!ok) return;
    await runAction(async () => {
      await deleteProperty(selectedProperty.id);
      setSelectedPropertyId("");
      setBundle(emptyBundle);
      setSelectedPinId("");
      await reloadAll("");
      setView("review");
    }, "記録を削除しました。");
  };

  const handleSample = async (layoutType: SampleLayoutType) => {
    await runAction(async () => {
      const property = await createSamplePropertyWithLayout(layoutType);
      setSelectedPropertyId(property.id);
      await reloadAll(property.id);
      setView("detail");
    }, "動作確認用サンプルを追加しました。");
  };

  return (
    <main className="min-h-screen bg-ledger-paper text-ledger-ink">
      <header className="border-b border-ledger-line bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <button type="button" className="text-left" onClick={() => setView("home")}>
            <p className="text-xs font-bold text-ledger-primary">{APP_NAME}</p>
            <h1 className="mt-1 text-lg font-bold">入居時の部屋の状態を残す</h1>
          </button>
          {view !== "home" ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-ledger-line bg-white px-4 text-sm font-bold text-ledger-primary"
              onClick={() => setView("home")}
            >
              <Home aria-hidden size={18} />
              最初へ
            </button>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl px-4 py-5">
        {message ? <StatusMessage message={message} /> : null}
        {view === "home" ? (
          <HomeView properties={properties} onCreate={startCreate} onReview={openReview} onSample={handleSample} busy={busy} />
        ) : null}
        {view === "create" ? (
          <CreateFlow
            property={selectedProperty}
            bundle={bundle}
            step={createStep}
            selectedPinId={selectedPinId}
            busy={busy}
            onBackHome={() => setView("home")}
            onStepChange={setCreateStep}
            onCreateRecord={handleCreateRecord}
            onSaveFloorPlan={handleSaveFloorPlan}
            onAddPin={handleAddPin}
            onMovePin={handleMovePin}
            onSelectPin={setSelectedPinId}
            onUpdatePinName={handleUpdatePinName}
            onDeletePin={handleDeletePin}
            onAddPhoto={handleAddPhoto}
            onDeletePhoto={handleDeletePhoto}
            onOpenDetail={() => setView("detail")}
          />
        ) : null}
        {view === "review" ? <ReviewList properties={properties} onBack={() => setView("home")} onOpen={openDetail} /> : null}
        {view === "detail" && selectedProperty ? (
          <ReviewDetail
            property={selectedProperty}
            bundle={bundle}
            selectedPinId={selectedPinId}
            busy={busy}
            onBack={() => setView("review")}
            onEdit={startEdit}
            onDelete={handleDeleteProperty}
            onSelectPin={setSelectedPinId}
            onExported={async (fileName) => {
              await addExportHistory(selectedProperty.id, fileName);
              await reloadAll(selectedProperty.id);
            }}
            onRunAction={runAction}
          />
        ) : null}
      </div>
    </main>
  );
}

function HomeView({
  properties,
  onCreate,
  onReview,
  onSample,
  busy
}: {
  properties: Property[];
  onCreate: () => void;
  onReview: () => void;
  onSample: (layoutType: SampleLayoutType) => Promise<void>;
  busy: boolean;
}) {
  return (
    <div className="space-y-5">
      <Notice message={APP_NOTICE} />
      <section className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          className="flex min-h-36 flex-col items-start justify-between rounded-md border border-ledger-line bg-white p-5 text-left shadow-sm hover:border-ledger-primary"
          onClick={onCreate}
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-ledger-primary text-white">
            <Plus aria-hidden size={24} />
          </span>
          <span>
            <span className="block text-xl font-bold">物件を作成</span>
            <span className="mt-2 block text-sm leading-6 text-ledger-muted">
              部屋名と入居日を入れて、間取りと写真を登録します。
            </span>
          </span>
        </button>
        <button
          type="button"
          className="flex min-h-36 flex-col items-start justify-between rounded-md border border-ledger-line bg-white p-5 text-left shadow-sm hover:border-ledger-primary"
          onClick={onReview}
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-ledger-primary text-white">
            <Eye aria-hidden size={24} />
          </span>
          <span>
            <span className="block text-xl font-bold">物件を確認</span>
            <span className="mt-2 block text-sm leading-6 text-ledger-muted">
              保存した間取り、ピン、写真を確認します。保存済み: {properties.length}件
            </span>
          </span>
        </button>
      </section>
      {import.meta.env.DEV ? <DevSamplePanel onSample={onSample} busy={busy} /> : null}
    </div>
  );
}

function DevSamplePanel({
  onSample,
  busy
}: {
  onSample: (layoutType: SampleLayoutType) => Promise<void>;
  busy: boolean;
}) {
  return (
    <section className="rounded-md border border-dashed border-ledger-line bg-white p-4">
      <h2 className="text-sm font-bold text-ledger-muted">開発中の動作確認用</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {SAMPLE_LAYOUTS.map((layout) => (
          <button
            type="button"
            key={layout.type}
            className="min-h-12 rounded-md border border-ledger-line px-3 py-2 text-left text-sm font-bold text-ledger-primary hover:bg-teal-50 disabled:opacity-50"
            disabled={busy}
            onClick={() => void onSample(layout.type)}
          >
            <span className="block">{layout.title}</span>
            <span className="mt-1 block text-xs font-normal text-ledger-muted">{layout.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CreateFlow({
  property,
  bundle,
  step,
  selectedPinId,
  busy,
  onBackHome,
  onStepChange,
  onCreateRecord,
  onSaveFloorPlan,
  onAddPin,
  onMovePin,
  onSelectPin,
  onUpdatePinName,
  onDeletePin,
  onAddPhoto,
  onDeletePhoto,
  onOpenDetail
}: {
  property: Property | null;
  bundle: PropertyBundle;
  step: CreateStep;
  selectedPinId: string;
  busy: boolean;
  onBackHome: () => void;
  onStepChange: (step: CreateStep) => void;
  onCreateRecord: (input: { name: string; moveInDate: string; recordDate: string }) => Promise<void>;
  onSaveFloorPlan: (input: {
    fileName: string;
    blob: Blob;
    pageCount: number;
    naturalWidth: number;
    naturalHeight: number;
    cropRect: CropRect;
  }) => Promise<void>;
  onAddPin: (point: { x: number; y: number }) => Promise<void>;
  onMovePin: (pinId: string, point: { x: number; y: number }) => Promise<void>;
  onSelectPin: (pinId: string) => void;
  onUpdatePinName: (pinId: string, placeName: string) => Promise<void>;
  onDeletePin: (pinId: string) => Promise<void>;
  onAddPhoto: (input: {
    pinId: string;
    file: File;
    targetName: string;
    category: PhotoCategory;
    comment: string;
  }) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onOpenDetail: () => void;
}) {
  const selectedPin = bundle.pins.find((pin) => pin.id === selectedPinId) ?? bundle.pins.at(0) ?? null;

  return (
    <section className="space-y-4">
      <PageTitle title="物件を作成" subtitle={property ? property.name : "部屋情報から始めます。"} onBack={onBackHome} />
      <StepNav current={step} property={property} bundle={bundle} onChange={onStepChange} />

      {step === "info" ? <RoomInfoForm busy={busy} onCreate={onCreateRecord} /> : null}
      {step === "floor" ? (
        <FloorPlanUploadCropper floorPlan={bundle.floorPlan} busy={busy} onSave={onSaveFloorPlan} onNext={() => onStepChange("pins")} />
      ) : null}
      {step === "pins" ? (
        <PinPlacementStep
          floorPlan={bundle.floorPlan}
          pins={bundle.pins}
          selectedPinId={selectedPinId}
          selectedPin={selectedPin}
          busy={busy}
          onSelectPin={onSelectPin}
          onAddPin={onAddPin}
          onMovePin={onMovePin}
          onUpdatePinName={onUpdatePinName}
          onDeletePin={onDeletePin}
          onNext={() => onStepChange("photos")}
          onBack={() => onStepChange("floor")}
        />
      ) : null}
      {step === "photos" ? (
        <PhotoStep
          pins={bundle.pins}
          photos={bundle.photos}
          selectedPinId={selectedPinId}
          busy={busy}
          onSelectPin={onSelectPin}
          onAddPhoto={onAddPhoto}
          onDeletePhoto={onDeletePhoto}
          onNext={() => onStepChange("finish")}
          onBack={() => onStepChange("pins")}
        />
      ) : null}
      {step === "finish" && property ? (
        <FinishStep property={property} bundle={bundle} onOpenDetail={onOpenDetail} onBack={() => onStepChange("photos")} />
      ) : null}
    </section>
  );
}

function StepNav({
  current,
  property,
  bundle,
  onChange
}: {
  current: CreateStep;
  property: Property | null;
  bundle: PropertyBundle;
  onChange: (step: CreateStep) => void;
}) {
  const canOpen = (step: CreateStep) => {
    if (step === "info") return true;
    if (!property) return false;
    if (step === "floor") return true;
    if (!bundle.floorPlan) return false;
    if (step === "pins") return true;
    if (step === "photos") return bundle.pins.length > 0;
    return bundle.pins.length > 0;
  };

  return (
    <nav className="overflow-x-auto rounded-md border border-ledger-line bg-white p-2">
      <div className="flex min-w-max gap-2">
        {createSteps.map((item, index) => {
          const active = item.id === current;
          return (
            <button
              type="button"
              key={item.id}
              disabled={!canOpen(item.id)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-bold disabled:opacity-40 ${
                active ? "bg-ledger-primary text-white" : "bg-ledger-paper text-ledger-muted hover:text-ledger-primary"
              }`}
              onClick={() => onChange(item.id)}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-xs text-ledger-primary">
                {index + 1}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function RoomInfoForm({
  busy,
  onCreate
}: {
  busy: boolean;
  onCreate: (input: { name: string; moveInDate: string; recordDate: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [moveInDate, setMoveInDate] = useState(() => getLocalDateInputValue());
  const [recordDate, setRecordDate] = useState(() => getLocalDateInputValue());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate({ name, moveInDate, recordDate });
  };

  return (
    <section className="rounded-md border border-ledger-line bg-white p-4">
      <h2 className="text-xl font-bold">部屋情報</h2>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="block text-sm font-bold sm:col-span-2">
          部屋名
          <input
            className="mt-1 min-h-12 w-full rounded-md border border-ledger-line px-3 text-base"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: 自宅 202号室"
          />
        </label>
        <label className="block text-sm font-bold">
          入居日
          <input
            type="date"
            className="mt-1 min-h-12 w-full rounded-md border border-ledger-line px-3 text-base"
            value={moveInDate}
            onChange={(event) => setMoveInDate(event.target.value)}
          />
        </label>
        <label className="block text-sm font-bold">
          作成日
          <input
            type="date"
            className="mt-1 min-h-12 w-full rounded-md border border-ledger-line px-3 text-base"
            value={recordDate}
            onChange={(event) => setRecordDate(event.target.value)}
          />
        </label>
        <p className="rounded-md bg-ledger-paper p-3 text-sm leading-6 text-ledger-muted sm:col-span-2">
          住所、賃料、契約情報などは入力しません。記録に必要な最小限の情報だけを保存します。
        </p>
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50 sm:col-span-2"
          disabled={busy || !name.trim()}
        >
          <Save aria-hidden size={20} />
          間取りの読み込みへ
        </button>
      </form>
    </section>
  );
}

function FloorPlanUploadCropper({
  floorPlan,
  busy,
  onSave,
  onNext
}: {
  floorPlan: FloorPlan | null;
  busy: boolean;
  onSave: (input: {
    fileName: string;
    blob: Blob;
    pageCount: number;
    naturalWidth: number;
    naturalHeight: number;
    cropRect: CropRect;
  }) => Promise<void>;
  onNext: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [cropRect, setCropRect] = useState<CropRect>({ x: 0.04, y: 0.04, width: 0.92, height: 0.92 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [error, setError] = useState("");

  const renderPreview = useCallback(async () => {
    if (!file || !canvasRef.current || !wrapRef.current) return;
    try {
      const nextPreview = await renderUploadSource(file, canvasRef.current, wrapRef.current.clientWidth);
      setPreview(nextPreview);
      setError("");
    } catch (renderError) {
      setPreview(null);
      setError(renderError instanceof Error ? renderError.message : "間取りを読み込めませんでした。");
    }
  }, [file]);

  useEffect(() => {
    if (!file) return;
    void renderPreview();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => void renderPreview());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [file, renderPreview]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    setFile(nextFile);
    setPreview(null);
    setCropRect({ x: 0.04, y: 0.04, width: 0.92, height: 0.92 });
    setError("");
  };

  const getPoint = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!preview) return;
    const point = getPoint(event);
    setDragStart(point);
    setCropRect(normalizeCropRect(point, point));
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    setCropRect(normalizeCropRect(dragStart, getPoint(event)));
  };

  const handlePointerUp = () => setDragStart(null);

  const handleSave = async () => {
    if (!file || !preview || !canvasRef.current) return;
    const crop = await cropCanvasToPngBlob(canvasRef.current, cropRect);
    await onSave({
      fileName: makeCroppedFileName(file.name),
      blob: crop.blob,
      pageCount: preview.pageCount,
      naturalWidth: crop.width,
      naturalHeight: crop.height,
      cropRect
    });
  };

  return (
    <section className="space-y-4 rounded-md border border-ledger-line bg-white p-4">
      <div>
        <h2 className="text-xl font-bold">間取りを読み込む</h2>
        <p className="mt-2 text-sm leading-6 text-ledger-muted">
          PDFまたは画像を読み込み、必要な間取り部分だけを四角い枠で選びます。保存するのは切り抜いた画像です。
        </p>
      </div>

      {floorPlan ? (
        <div className="rounded-md border border-teal-100 bg-teal-50 p-3 text-sm text-ledger-primary">
          登録済みの間取りがあります。新しいファイルを保存すると、間取りだけが差し替わります。
        </div>
      ) : null}

      <label className="block text-sm font-bold">
        PDFまたは画像
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="mt-1 block min-h-12 w-full rounded-md border border-ledger-line bg-white px-3 py-2"
          onChange={handleFileChange}
        />
      </label>

      <div ref={wrapRef} className="overflow-x-auto rounded-md border border-ledger-line bg-slate-100 p-2">
        {error ? <p className="p-3 text-sm text-red-700">{error}</p> : null}
        {file ? (
          <div className="relative inline-block max-w-full align-top">
            <canvas ref={canvasRef} className="block max-w-full" />
            {preview ? (
              <div
                className="absolute inset-0 cursor-crosshair touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                <div
                  className="absolute border-2 border-ledger-warn bg-amber-200/20"
                  style={{
                    left: `${cropRect.x * 100}%`,
                    top: `${cropRect.y * 100}%`,
                    width: `${cropRect.width * 100}%`,
                    height: `${cropRect.height * 100}%`
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-ledger-muted">
            <Upload aria-hidden size={32} />
            <p className="text-sm">読み込むファイルを選択してください。</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-ledger-line px-4 font-bold text-ledger-primary disabled:opacity-50"
          disabled={!preview}
          onClick={() => setCropRect({ x: 0, y: 0, width: 1, height: 1 })}
        >
          <ImageIcon aria-hidden size={20} />
          全体を使う
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50"
          disabled={busy || !preview}
          onClick={() => void handleSave()}
        >
          <Save aria-hidden size={20} />
          この範囲を保存
        </button>
      </div>

      {floorPlan ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-bold text-ledger-primary"
          onClick={onNext}
        >
          ピンの作成へ進む
        </button>
      ) : null}
    </section>
  );
}

function PinPlacementStep({
  floorPlan,
  pins,
  selectedPinId,
  selectedPin,
  busy,
  onSelectPin,
  onAddPin,
  onMovePin,
  onUpdatePinName,
  onDeletePin,
  onNext,
  onBack
}: {
  floorPlan: FloorPlan | null;
  pins: FloorPlanPin[];
  selectedPinId: string;
  selectedPin: FloorPlanPin | null;
  busy: boolean;
  onSelectPin: (pinId: string) => void;
  onAddPin: (point: { x: number; y: number }) => Promise<void>;
  onMovePin: (pinId: string, point: { x: number; y: number }) => Promise<void>;
  onUpdatePinName: (pinId: string, placeName: string) => Promise<void>;
  onDeletePin: (pinId: string) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<MapMode>("select");

  if (!floorPlan) {
    return <EmptyPanel title="間取りがありません" text="先に間取りを読み込んでください。" actionLabel="間取りへ戻る" onAction={onBack} />;
  }

  const handleMapPoint = async (point: { x: number; y: number }) => {
    if (mode === "add") {
      await onAddPin(point);
      setMode("select");
      return;
    }
    if (mode === "move" && selectedPinId) {
      await onMovePin(selectedPinId, point);
      setMode("select");
    }
  };

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-ledger-line bg-white p-4">
        <h2 className="text-xl font-bold">間取りにピンを置く</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-bold ${
              mode === "add" ? "bg-ledger-primary text-white" : "border border-ledger-line text-ledger-primary"
            }`}
            onClick={() => setMode(mode === "add" ? "select" : "add")}
          >
            <Plus aria-hidden size={18} />
            ピンを追加
          </button>
          <button
            type="button"
            className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-bold disabled:opacity-50 ${
              mode === "move" ? "bg-ledger-primary text-white" : "border border-ledger-line text-ledger-primary"
            }`}
            disabled={!selectedPin}
            onClick={() => setMode(mode === "move" ? "select" : "move")}
          >
            <Move aria-hidden size={18} />
            選択中のピンを移動
          </button>
        </div>
        <p className="mt-3 text-sm text-ledger-muted">
          {mode === "add"
            ? "間取り上の追加したい場所を押してください。"
            : mode === "move"
              ? "移動先を押してください。"
              : "ピンを選ぶと場所名を編集できます。"}
        </p>
        <FloorPlanMap
          floorPlan={floorPlan}
          pins={pins}
          selectedPinId={selectedPinId}
          mode={mode}
          onSelectPin={onSelectPin}
          onMapPoint={handleMapPoint}
        />
      </div>

      <PinTabs pins={pins} photos={[]} selectedPinId={selectedPinId} onSelectPin={onSelectPin} />
      {selectedPin ? (
        <PinNamePanel
          pin={selectedPin}
          busy={busy}
          onSave={(placeName) => onUpdatePinName(selectedPin.id, placeName)}
          onDelete={() => onDeletePin(selectedPin.id)}
        />
      ) : (
        <EmptyPanel title="ピンがありません" text="ピンを追加して、場所名を入力してください。" />
      )}

      <StepActions onBack={onBack} onNext={onNext} nextDisabled={pins.length === 0} nextLabel="写真の登録へ" />
    </section>
  );
}

function PhotoStep({
  pins,
  photos,
  selectedPinId,
  busy,
  onSelectPin,
  onAddPhoto,
  onDeletePhoto,
  onNext,
  onBack
}: {
  pins: FloorPlanPin[];
  photos: PhotoRecord[];
  selectedPinId: string;
  busy: boolean;
  onSelectPin: (pinId: string) => void;
  onAddPhoto: (input: {
    pinId: string;
    file: File;
    targetName: string;
    category: PhotoCategory;
    comment: string;
  }) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
}) {
  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? pins.at(0) ?? null;
  const pinPhotos = selectedPin ? photos.filter((photo) => photo.pinId === selectedPin.id) : [];

  if (!selectedPin) {
    return <EmptyPanel title="ピンがありません" text="先に間取りへピンを追加してください。" actionLabel="ピンへ戻る" onAction={onBack} />;
  }

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-ledger-line bg-white p-4">
        <h2 className="text-xl font-bold">ピンごとに写真を追加</h2>
        <p className="mt-2 text-sm leading-6 text-ledger-muted">
          写真は選択中のピンに紐づきます。撮影箇所には、窓枠右下や床の中央など具体的な場所を入れます。
        </p>
        <PinTabs pins={pins} photos={photos} selectedPinId={selectedPin.id} onSelectPin={onSelectPin} />
      </div>

      <PhotoForm pin={selectedPin} busy={busy} onAddPhoto={onAddPhoto} />
      <PinPhotoList photos={pinPhotos} onDelete={onDeletePhoto} />
      <StepActions onBack={onBack} onNext={onNext} nextLabel="保存内容を確認" />
    </section>
  );
}

function FinishStep({
  property,
  bundle,
  onOpenDetail,
  onBack
}: {
  property: Property;
  bundle: PropertyBundle;
  onOpenDetail: () => void;
  onBack: () => void;
}) {
  const photoPinCount = new Set(bundle.photos.map((photo) => photo.pinId)).size;
  return (
    <section className="rounded-md border border-ledger-line bg-white p-4">
      <h2 className="text-xl font-bold">保存内容を確認</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="ピン" value={bundle.pins.length} />
        <Metric label="写真" value={bundle.photos.length} />
        <Metric label="写真ありの場所" value={photoPinCount} />
      </div>
      <div className="mt-4 rounded-md bg-ledger-paper p-4 text-sm leading-6 text-ledger-muted">
        <p className="font-bold text-ledger-ink">{property.name}</p>
        <p>入居日: {property.moveInDate || "未入力"}</p>
        <p>作成日: {property.recordDate || "未入力"}</p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-ledger-line px-4 font-bold text-ledger-primary"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden size={18} />
          写真へ戻る
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white"
          onClick={onOpenDetail}
        >
          <Eye aria-hidden size={18} />
          物件を確認
        </button>
      </div>
    </section>
  );
}

function ReviewList({
  properties,
  onBack,
  onOpen
}: {
  properties: Property[];
  onBack: () => void;
  onOpen: (propertyId: string) => void;
}) {
  return (
    <section className="space-y-4">
      <PageTitle title="物件を確認" subtitle="保存した記録を開きます。" onBack={onBack} />
      <div className="rounded-md border border-ledger-line bg-white p-4">
        {properties.length === 0 ? (
          <EmptyPanel title="保存済みの記録がありません" text="最初の画面から物件を作成してください。" />
        ) : (
          <div className="grid gap-2">
            {properties.map((property) => (
              <button
                type="button"
                key={property.id}
                className="rounded-md border border-ledger-line bg-white p-4 text-left hover:border-ledger-primary"
                onClick={() => onOpen(property.id)}
              >
                <span className="block text-lg font-bold">{property.name}</span>
                <span className="mt-2 block text-sm text-ledger-muted">
                  入居日: {property.moveInDate || "未入力"} / 作成日: {property.recordDate || "未入力"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ReviewDetail({
  property,
  bundle,
  selectedPinId,
  busy,
  onBack,
  onEdit,
  onDelete,
  onSelectPin,
  onExported,
  onRunAction
}: {
  property: Property;
  bundle: PropertyBundle;
  selectedPinId: string;
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onSelectPin: (pinId: string) => void;
  onExported: (fileName: string) => Promise<void>;
  onRunAction: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
}) {
  const selectedPin = bundle.pins.find((pin) => pin.id === selectedPinId) ?? bundle.pins.at(0) ?? null;
  const pinPhotos = selectedPin ? bundle.photos.filter((photo) => photo.pinId === selectedPin.id) : [];

  return (
    <section className="space-y-4">
      <PageTitle title={property.name} subtitle={`入居日: ${property.moveInDate || "未入力"} / 作成日: ${property.recordDate || "未入力"}`} onBack={onBack} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-ledger-line bg-white px-4 font-bold text-ledger-primary"
          onClick={onEdit}
        >
          <Edit3 aria-hidden size={18} />
          編集する
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 font-bold text-red-700"
          onClick={() => void onDelete()}
        >
          <Trash2 aria-hidden size={18} />
          削除
        </button>
      </div>

      <section className="rounded-md border border-ledger-line bg-white p-4">
        <h2 className="text-xl font-bold">間取り</h2>
        {bundle.floorPlan ? (
          <>
            <FloorPlanMap
              floorPlan={bundle.floorPlan}
              pins={bundle.pins}
              selectedPinId={selectedPin?.id ?? ""}
              mode="select"
              onSelectPin={onSelectPin}
            />
            <PinTabs pins={bundle.pins} photos={bundle.photos} selectedPinId={selectedPin?.id ?? ""} onSelectPin={onSelectPin} />
          </>
        ) : (
          <EmptyPanel title="間取りがありません" text="編集から間取りを読み込んでください。" />
        )}
      </section>

      {selectedPin ? (
        <section className="rounded-md border border-ledger-line bg-white p-4">
          <h2 className="text-xl font-bold">
            ピン {selectedPin.label}: {selectedPin.placeName || "場所名未入力"}
          </h2>
          <PinPhotoList photos={pinPhotos} onDelete={async () => undefined} readonly />
        </section>
      ) : null}

      <ExportPanel property={property} bundle={bundle} busy={busy} onExported={onExported} onRunAction={onRunAction} />
    </section>
  );
}

function FloorPlanMap({
  floorPlan,
  pins,
  selectedPinId,
  mode,
  onSelectPin,
  onMapPoint
}: {
  floorPlan: FloorPlan;
  pins: FloorPlanPin[];
  selectedPinId: string;
  mode: MapMode;
  onSelectPin: (pinId: string) => void;
  onMapPoint?: (point: { x: number; y: number }) => Promise<void>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");

  const draw = useCallback(async () => {
    if (!wrapRef.current || !canvasRef.current) return;
    try {
      const result = await renderFloorPlan(floorPlan, canvasRef.current, wrapRef.current.clientWidth);
      setSize(result);
      setError("");
    } catch {
      setError("間取りを表示できませんでした。");
    }
  }, [floorPlan]);

  useEffect(() => {
    void draw();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => void draw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  const handlePointer = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (!onMapPoint || mode === "select") return;
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    await onMapPoint({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    });
  };

  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-ledger-line bg-slate-100 p-2" ref={wrapRef}>
      {error ? <p className="p-3 text-sm text-red-700">{error}</p> : null}
      <div
        className="relative inline-block max-w-full align-top"
        style={{ width: size.width || undefined, height: size.height || undefined }}
      >
        <canvas ref={canvasRef} className="block max-w-full" />
        <div
          className={`absolute inset-0 ${mode === "select" ? "cursor-default" : "cursor-crosshair"}`}
          onPointerDown={(event) => void handlePointer(event)}
        >
          {pins.map((pin) => (
            <button
              type="button"
              key={pin.id}
              className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold text-white shadow ${
                selectedPinId === pin.id ? "bg-ledger-warn ring-4 ring-amber-200" : "bg-ledger-accent"
              }`}
              style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSelectPin(pin.id);
              }}
            >
              {pin.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PinTabs({
  pins,
  photos,
  selectedPinId,
  onSelectPin
}: {
  pins: FloorPlanPin[];
  photos: PhotoRecord[];
  selectedPinId: string;
  onSelectPin: (pinId: string) => void;
}) {
  if (pins.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto pb-2">
      <div className="flex min-w-max gap-2">
        {pins.map((pin) => {
          const selected = pin.id === selectedPinId;
          const photoCount = photos.filter((photo) => photo.pinId === pin.id).length;
          return (
            <button
              type="button"
              key={pin.id}
              className={`relative min-h-16 w-40 rounded-md border p-3 text-left ${
                selected ? "border-ledger-primary bg-teal-50" : "border-ledger-line bg-white hover:bg-slate-50"
              }`}
              onClick={() => onSelectPin(pin.id)}
            >
              <span className="block text-sm font-bold text-ledger-primary">ピン {pin.label}</span>
              <span className="mt-1 block truncate text-sm">{pin.placeName || "場所名未入力"}</span>
              <span className="absolute right-2 top-2 rounded-full bg-ledger-paper px-2 py-0.5 text-[11px] font-bold text-ledger-muted">
                写真 {photoCount}
              </span>
              {pin.placeName.trim() && photoCount > 0 ? (
                <span className="absolute bottom-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ledger-primary text-white">
                  <Check aria-hidden size={13} />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PinNamePanel({
  pin,
  busy,
  onSave,
  onDelete
}: {
  pin: FloorPlanPin;
  busy: boolean;
  onSave: (placeName: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [placeName, setPlaceName] = useState(pin.placeName);

  useEffect(() => setPlaceName(pin.placeName), [pin.id, pin.placeName]);

  return (
    <section className="rounded-md border border-ledger-line bg-white p-4">
      <h3 className="text-lg font-bold">ピン {pin.label} の場所名</h3>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          className="min-h-12 flex-1 rounded-md border border-ledger-line px-3 text-base"
          value={placeName}
          onChange={(event) => setPlaceName(event.target.value)}
          placeholder="例: リビングの窓"
        />
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50"
          disabled={busy}
          onClick={() => void onSave(placeName)}
        >
          <Save aria-hidden size={18} />
          保存
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-red-200 px-4 font-bold text-red-700"
          onClick={() => void onDelete()}
        >
          <Trash2 aria-hidden size={18} />
          削除
        </button>
      </div>
    </section>
  );
}

function PhotoForm({
  pin,
  busy,
  onAddPhoto
}: {
  pin: FloorPlanPin;
  busy: boolean;
  onAddPhoto: (input: {
    pinId: string;
    file: File;
    targetName: string;
    category: PhotoCategory;
    comment: string;
  }) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [targetName, setTargetName] = useState("");
  const [category, setCategory] = useState<PhotoCategory>(PHOTO_CATEGORIES[0] ?? "その他");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setFile(null);
    setTargetName("");
    setComment("");
  }, [pin.id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    await onAddPhoto({ pinId: pin.id, file, targetName, category, comment });
    setFile(null);
    setTargetName("");
    setComment("");
  };

  return (
    <form className="grid gap-3 rounded-md border border-ledger-line bg-white p-4 sm:grid-cols-2" onSubmit={handleSubmit}>
      <h3 className="text-lg font-bold sm:col-span-2">
        ピン {pin.label}: {pin.placeName || "場所名未入力"}
      </h3>
      <label className="block text-sm font-bold sm:col-span-2">
        写真
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="mt-1 block min-h-12 w-full rounded-md border border-ledger-line bg-white px-3 py-2"
          onChange={(event: ChangeEvent<HTMLInputElement>) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <label className="block text-sm font-bold">
        撮影箇所
        <input
          className="mt-1 min-h-12 w-full rounded-md border border-ledger-line px-3 text-base"
          value={targetName}
          onChange={(event) => setTargetName(event.target.value)}
          placeholder="例: 窓枠右下"
        />
      </label>
      <label className="block text-sm font-bold">
        カテゴリー
        <select
          className="mt-1 min-h-12 w-full rounded-md border border-ledger-line bg-white px-3 text-base"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {PHOTO_CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-bold sm:col-span-2">
        コメント
        <textarea
          className="mt-1 min-h-24 w-full rounded-md border border-ledger-line px-3 py-2 text-base"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="例: 入居時から小さな傷あり"
        />
      </label>
      <button
        type="submit"
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50 sm:col-span-2"
        disabled={busy || !file}
      >
        <Camera aria-hidden size={20} />
        このピンに写真を追加
      </button>
    </form>
  );
}

function PinPhotoList({
  photos,
  onDelete,
  readonly = false
}: {
  photos: PhotoRecord[];
  onDelete: (photoId: string) => Promise<void>;
  readonly?: boolean;
}) {
  if (photos.length === 0) {
    return <EmptyPanel title="写真がありません" text="このピンにはまだ写真が登録されていません。" />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {photos.map((photo) => (
        <article key={photo.id} className="rounded-md border border-ledger-line bg-white p-3">
          <BlobImage blob={photo.imageBlob} alt={photo.imageFileName} />
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-bold">{photo.targetName || "撮影箇所未入力"}</p>
            <p className="text-ledger-muted">{photo.category}</p>
            <p>{photo.comment || "コメント未入力"}</p>
            <p className="text-xs text-ledger-muted">{formatDateTime(photo.takenAt)}</p>
          </div>
          {!readonly ? (
            <button
              type="button"
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-bold text-red-700"
              onClick={() => void onDelete(photo.id)}
            >
              <Trash2 aria-hidden size={16} />
              削除
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function ExportPanel({
  property,
  bundle,
  busy,
  onExported,
  onRunAction
}: {
  property: Property;
  bundle: PropertyBundle;
  busy: boolean;
  onExported: (fileName: string) => Promise<void>;
  onRunAction: (action: () => Promise<void>, successMessage?: string) => Promise<void>;
}) {
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");

  const handleGenerate = async () => {
    await onRunAction(async () => {
      const blob = await generateLedgerPdf({
        property,
        floorPlan: bundle.floorPlan,
        pins: bundle.pins,
        checklistItems: bundle.checklistItems,
        photos: bundle.photos
      });
      const nextFileName = buildLedgerFileName(property.name);
      setPdfBlob(blob);
      setFileName(nextFileName);
      await onExported(nextFileName);
    }, "PDF台帳を作成しました。");
  };

  const handleDownload = () => {
    if (!pdfBlob) return;
    const url = URL.createObjectURL(pdfBlob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (!pdfBlob) return;
    const file = new File([pdfBlob], fileName, { type: "application/pdf" });
    const navigatorWithShare = navigator as Navigator & {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
    };

    if (navigatorWithShare.share && navigatorWithShare.canShare?.({ files: [file] })) {
      await navigatorWithShare.share({
        title: SHARE_MAIL_SUBJECT,
        text: SHARE_MAIL_BODY,
        files: [file]
      });
      return;
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${SHARE_MAIL_SUBJECT}\n\n${SHARE_MAIL_BODY}`);
    }
    alert("共有用の文面をコピーしました。PDFは保存ボタンから保存してください。");
  };

  return (
    <section className="rounded-md border border-ledger-line bg-white p-4">
      <h2 className="text-xl font-bold">PDF保存</h2>
      <p className="mt-2 text-sm leading-6 text-ledger-muted">間取り、ピン、写真をPDF台帳にまとめます。</p>
      <button
        type="button"
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50"
        disabled={busy}
        onClick={() => void handleGenerate()}
      >
        <FileText aria-hidden size={20} />
        PDF台帳を作成
      </button>
      {pdfBlob ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-ledger-line px-4 font-bold text-ledger-primary"
            onClick={handleDownload}
          >
            <Download aria-hidden size={20} />
            PDFを保存
          </button>
          <button
            type="button"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-ledger-line px-4 font-bold text-ledger-primary"
            onClick={() => void handleShare()}
          >
            <Share2 aria-hidden size={20} />
            共有
          </button>
        </div>
      ) : null}
      {bundle.exportHistory.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="font-bold">出力履歴</h3>
          {bundle.exportHistory.slice(0, 5).map((history) => (
            <p key={history.id} className="rounded-md bg-ledger-paper p-3 text-sm">
              {history.fileName}
              <span className="mt-1 block text-xs text-ledger-muted">{formatDateTime(history.exportedAt)}</span>
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function BlobImage({ blob, alt }: { blob: Blob; alt: string }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  return url ? <img src={url} alt={alt} className="h-52 w-full rounded-md object-cover" /> : null;
}

function PageTitle({
  title,
  subtitle,
  onBack
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-ledger-muted">{subtitle}</p> : null}
      </div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-ledger-line bg-white px-4 font-bold text-ledger-primary"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden size={18} />
        戻る
      </button>
    </div>
  );
}

function StepActions({
  onBack,
  onNext,
  nextDisabled = false,
  nextLabel
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button
        type="button"
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md border border-ledger-line bg-white px-4 font-bold text-ledger-primary"
        onClick={onBack}
      >
        <ArrowLeft aria-hidden size={18} />
        戻る
      </button>
      <button
        type="button"
        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50"
        disabled={nextDisabled}
        onClick={onNext}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function EmptyPanel({
  title,
  text,
  actionLabel,
  onAction
}: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-md border border-ledger-line bg-white p-5 text-center">
      <p className="font-bold">{title}</p>
      <p className="mt-2 text-sm leading-6 text-ledger-muted">{text}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md bg-ledger-primary px-4 font-bold text-white"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-ledger-paper px-3 py-4 text-center">
      <p className="text-2xl font-bold text-ledger-primary">{value}</p>
      <p className="mt-1 text-xs text-ledger-muted">{label}</p>
    </div>
  );
}

function Notice({ message }: { message: string }) {
  return <p className="rounded-md border border-teal-100 bg-teal-50 p-3 text-sm leading-6 text-ledger-primary">{message}</p>;
}

function StatusMessage({ message }: { message: string }) {
  return <p className="mb-4 rounded-md border border-ledger-line bg-white p-3 text-sm text-ledger-muted">{message}</p>;
}

function makeCroppedFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  return `${baseName || "floor-plan"}_cropped.png`;
}
