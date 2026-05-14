import {
  Camera,
  CheckSquare,
  Download,
  FileText,
  Home,
  MapPin,
  Move,
  Plus,
  Save,
  Share2,
  Trash2,
  Upload
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  APP_NAME,
  APP_NOTICE,
  DEFAULT_PIN_CHECKLIST_ITEMS,
  PHOTO_CATEGORIES,
  SHARE_MAIL_BODY,
  SHARE_MAIL_SUBJECT
} from "./constants";
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
  updateChecklistItem,
  updatePin
} from "./db";
import { compressImage } from "./lib/images";
import { getLocalDateInputValue } from "./lib/dates";
import { buildLedgerFileName, formatDateTime, generateLedgerPdf } from "./lib/ledgerPdf";
import { getPdfPageCount, renderFirstPdfPage } from "./lib/pdfPreview";
import { createSamplePropertyWithLayout } from "./lib/sampleData";
import { SAMPLE_LAYOUTS, type SampleLayoutType } from "./lib/sampleLayouts";
import type { ChecklistItem, FloorPlan, FloorPlanPin, PhotoCategory, PhotoRecord, Property, PropertyBundle } from "./types";

type SectionId = "overview" | "floor" | "export";

type PlanMode = "idle" | "add" | "move";

const emptyBundle: PropertyBundle = {
  floorPlan: null,
  pins: [],
  photos: [],
  checklistItems: [],
  exportHistory: []
};

const navItems: Array<{ id: SectionId; label: string; icon: typeof Home }> = [
  { id: "overview", label: "概要", icon: Home },
  { id: "floor", label: "記録", icon: MapPin },
  { id: "export", label: "PDF", icon: FileText }
];

export function AppShell() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [bundle, setBundle] = useState<PropertyBundle>(emptyBundle);
  const [section, setSection] = useState<SectionId>("overview");
  const [selectedPinId, setSelectedPinId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const selectedProperty = properties.find((property) => property.id === selectedPropertyId) ?? null;

  const refreshProperties = useCallback(async () => {
    const nextProperties = await listProperties();
    setProperties(nextProperties);
    setSelectedPropertyId((current) => current || nextProperties.at(0)?.id || "");
  }, []);

  const refreshBundle = useCallback(async (propertyId: string) => {
    if (!propertyId) {
      setBundle(emptyBundle);
      return;
    }
    setBundle(await loadPropertyBundle(propertyId));
  }, []);

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

  const reloadAll = async () => {
    await refreshProperties();
    if (selectedPropertyId) {
      await refreshBundle(selectedPropertyId);
    }
  };

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

  const handleCreateProperty = async (input: { name: string; moveInDate: string; moveOutDate: string }) => {
    await runAction(async () => {
      const property = await createProperty(input);
      await refreshProperties();
      setSelectedPropertyId(property.id);
      setSection("floor");
    }, "物件を作成しました。");
  };

  const handleSample = async (layoutType: SampleLayoutType) => {
    await runAction(async () => {
      const property = await createSamplePropertyWithLayout(layoutType);
      await refreshProperties();
      setSelectedPropertyId(property.id);
      setSection("floor");
    }, "サンプル間取りを作成しました。");
  };

  const handleDeleteProperty = async () => {
    if (!selectedProperty) return;
    const ok = window.confirm("この物件の記録を削除します。写真や間取りPDFも削除されます。");
    if (!ok) return;
    await runAction(async () => {
      await deleteProperty(selectedProperty.id);
      setSelectedPropertyId("");
      setSelectedPinId("");
      await refreshProperties();
      setBundle(emptyBundle);
    }, "物件を削除しました。");
  };

  const handleFloorPlanUpload = async (file: File) => {
    if (!selectedProperty) return;
    if (bundle.floorPlan && (bundle.pins.length > 0 || bundle.photos.length > 0)) {
      const ok = window.confirm("間取りPDFを差し替えます。既存のピンと写真は保持されますが、位置がずれる場合はピンを移動してください。");
      if (!ok) return;
    }
    await runAction(async () => {
      if (file.type !== "application/pdf") {
        throw new Error("PDFファイルを選択してください。");
      }
      const pageCount = await getPdfPageCount(file);
      await saveFloorPlan({
        propertyId: selectedProperty.id,
        fileName: file.name,
        fileBlob: file,
        pageCount
      });
      await reloadAll();
    }, "間取りPDFを保存しました。");
  };

  const handleAddPin = async (point: { x: number; y: number }) => {
    if (!selectedProperty || !bundle.floorPlan) return;
    await runAction(async () => {
      const label = String(bundle.pins.length + 1);
      const pin = await addPin({
        propertyId: selectedProperty.id,
        floorPlanId: bundle.floorPlan!.id,
        label,
        x: point.x,
        y: point.y
      });
      setSelectedPinId(pin.id);
      await reloadAll();
    }, "番号ピンを追加しました。");
  };

  const handleMovePin = async (pinId: string, point: { x: number; y: number }) => {
    await runAction(async () => {
      await updatePin(pinId, point);
      await reloadAll();
    }, "番号ピンを移動しました。");
  };

  const handlePhotoAdd = async (input: {
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
      await reloadAll();
    }, "写真を登録しました。");
  };

  return (
    <main className="min-h-screen bg-ledger-paper text-ledger-ink">
      <header className="border-b border-ledger-line bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-bold text-ledger-primary">{APP_NAME}</p>
            <h1 className="text-lg font-bold">部屋の状態を記録・整理</h1>
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-ledger-primary px-4 text-sm font-bold text-white disabled:opacity-50"
            onClick={() => setSection("overview")}
            disabled={!selectedProperty}
          >
            <Home aria-hidden size={18} />
            記録を見る
          </button>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-5 px-4 py-5 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <PropertyCreator onCreate={handleCreateProperty} disabled={busy} />
          <PropertyList
            properties={properties}
            selectedPropertyId={selectedPropertyId}
            onSelect={(id) => {
              setSelectedPropertyId(id);
              setSection("overview");
            }}
          />
        </aside>

        <section className="min-w-0 space-y-4">
          <Notice message={APP_NOTICE} />
          {message ? <StatusMessage message={message} /> : null}

          {!selectedProperty ? (
            <EmptyState onSample={handleSample} />
          ) : (
            <>
              <PropertyHeader
                property={selectedProperty}
                bundle={bundle}
                onDelete={handleDeleteProperty}
                disabled={busy}
              />
              <SectionNav section={section} onChange={setSection} />
              {section === "overview" ? <Overview property={selectedProperty} bundle={bundle} onChangeSection={setSection} /> : null}
              {section === "floor" ? (
                <FloorPlanSection
                  floorPlan={bundle.floorPlan}
                  pins={bundle.pins}
                  photos={bundle.photos}
                  checklistItems={bundle.checklistItems}
                  selectedPinId={selectedPinId}
                  busy={busy}
                  onUpload={handleFloorPlanUpload}
                  onSelectPin={setSelectedPinId}
                  onAddPin={handleAddPin}
                  onMovePin={handleMovePin}
                  onAddPhoto={handlePhotoAdd}
                  onDeletePhoto={async (photoId) => {
                    await runAction(async () => {
                      await deletePhotoRecord(photoId);
                      await reloadAll();
                    }, "写真を削除しました。");
                  }}
                  onUpdateChecklist={async (itemId, patch) => {
                    await runAction(async () => {
                      await updateChecklistItem(itemId, patch);
                      await reloadAll();
                    });
                  }}
                  onUpdatePin={async (pinId, placeName) => {
                    await runAction(async () => {
                      await updatePin(pinId, { placeName });
                      await reloadAll();
                    }, "場所名を保存しました。");
                  }}
                  onDeletePin={async (pinId) => {
                    const ok = window.confirm("この番号ピンと紐づく写真、確認項目を削除します。");
                    if (!ok) return;
                    await runAction(async () => {
                      await deletePin(pinId);
                      await reloadAll();
                    }, "番号ピンを削除しました。");
                  }}
                />
              ) : null}
              {section === "export" ? (
                <ExportSection
                  property={selectedProperty}
                  bundle={bundle}
                  busy={busy}
                  onExported={async (fileName) => {
                    await addExportHistory(selectedProperty.id, fileName);
                    await reloadAll();
                  }}
                  onRunAction={runAction}
                />
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function PropertyCreator({
  onCreate,
  disabled
}: {
  onCreate: (input: { name: string; moveInDate: string; moveOutDate: string }) => Promise<void>;
  disabled: boolean;
}) {
  const [name, setName] = useState("");
  const [moveInDate, setMoveInDate] = useState(() => getLocalDateInputValue());
  const [moveOutDate, setMoveOutDate] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onCreate({ name, moveInDate, moveOutDate });
    setName("");
    setMoveOutDate("");
  };

  return (
    <section className="rounded-lg border border-ledger-line bg-white p-4">
      <h2 className="text-base font-bold">物件を作成</h2>
      <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm font-bold">
          管理用の名前
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-ledger-line px-3 text-base"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例: 202号室 入居時"
          />
        </label>
        <p className="text-xs leading-5 text-ledger-muted">住所など、個人や物件を特定しやすい情報は避けることをおすすめします。</p>
        <label className="block text-sm font-bold">
          入居日
          <input
            type="date"
            className="mt-1 min-h-11 w-full rounded-md border border-ledger-line px-3 text-base"
            value={moveInDate}
            onChange={(event) => setMoveInDate(event.target.value)}
          />
        </label>
        <label className="block text-sm font-bold">
          退去日 任意
          <input
            type="date"
            className="mt-1 min-h-11 w-full rounded-md border border-ledger-line px-3 text-base"
            value={moveOutDate}
            onChange={(event) => setMoveOutDate(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50"
          disabled={disabled || !name.trim()}
        >
          <Plus aria-hidden size={20} />
          作成する
        </button>
      </form>
    </section>
  );
}

function PropertyList({
  properties,
  selectedPropertyId,
  onSelect
}: {
  properties: Property[];
  selectedPropertyId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-lg border border-ledger-line bg-white p-4">
      <h2 className="text-base font-bold">物件一覧</h2>
      <div className="mt-3 space-y-2">
        {properties.length === 0 ? <p className="text-sm text-ledger-muted">まだ物件がありません。</p> : null}
        {properties.map((property) => (
          <button
            type="button"
            key={property.id}
            className={`w-full rounded-md border p-3 text-left ${
              property.id === selectedPropertyId
                ? "border-ledger-primary bg-teal-50"
                : "border-ledger-line bg-white hover:bg-slate-50"
            }`}
            onClick={() => onSelect(property.id)}
          >
            <span className="block font-bold">{property.name}</span>
            <span className="mt-1 block text-xs text-ledger-muted">更新: {formatDateTime(property.updatedAt)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SampleLayoutButtons({
  onSample,
  disabled,
  compact = false
}: {
  onSample: (layoutType: SampleLayoutType) => Promise<void>;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mt-4 space-y-2" : "mt-5 grid gap-3 sm:grid-cols-3"}>
      {SAMPLE_LAYOUTS.map((layout) => (
        <button
          type="button"
          key={layout.type}
          className="min-h-12 rounded-md border border-ledger-line bg-white px-3 py-3 text-left font-bold text-ledger-primary hover:bg-teal-50 disabled:opacity-50"
          onClick={() => void onSample(layout.type)}
          disabled={disabled}
        >
          <span className="block">{layout.title}</span>
          <span className="mt-1 block text-xs font-normal leading-5 text-ledger-muted">{layout.description}</span>
        </button>
      ))}
    </div>
  );
}

function PropertyHeader({
  property,
  bundle,
  onDelete,
  disabled
}: {
  property: Property;
  bundle: PropertyBundle;
  onDelete: () => Promise<void>;
  disabled: boolean;
}) {
  return (
    <section className="rounded-lg border border-ledger-line bg-white p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold text-ledger-primary">選択中</p>
          <h2 className="mt-1 text-2xl font-bold">{property.name}</h2>
          <p className="mt-2 text-sm text-ledger-muted">
            入居日 {property.moveInDate || "未入力"} / 退去日 {property.moveOutDate || "未入力"}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-sm font-bold text-red-700 disabled:opacity-50"
          onClick={() => void onDelete()}
          disabled={disabled}
        >
          <Trash2 aria-hidden size={18} />
          削除
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="ピン" value={bundle.pins.length} />
        <Metric label="写真" value={bundle.photos.length} />
        <Metric label="確認済み" value={bundle.checklistItems.filter((item) => item.pinId && item.isChecked).length} />
      </div>
    </section>
  );
}

function SectionNav({ section, onChange }: { section: SectionId; onChange: (section: SectionId) => void }) {
  return (
    <nav className="grid grid-cols-3 gap-1 rounded-lg border border-ledger-line bg-white p-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            type="button"
            key={item.id}
            className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md text-xs font-bold ${
              section === item.id ? "bg-ledger-primary text-white" : "text-ledger-muted hover:bg-slate-50"
            }`}
            onClick={() => onChange(item.id)}
          >
            <Icon aria-hidden size={18} />
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

function Overview({
  property,
  bundle,
  onChangeSection
}: {
  property: Property;
  bundle: PropertyBundle;
  onChangeSection: (section: SectionId) => void;
}) {
  const photoPins = new Set(bundle.photos.map((photo) => photo.pinId)).size;
  const pinChecklistItems = bundle.checklistItems.filter((item) => item.pinId);
  const checked = pinChecklistItems.filter((item) => item.isChecked).length;
  const total = pinChecklistItems.length;

  return (
    <section className="rounded-lg border border-ledger-line bg-white p-4">
      <h2 className="text-xl font-bold">記録の状況</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <InfoPanel title="間取りPDF" value={bundle.floorPlan ? bundle.floorPlan.fileName : "未登録"} />
        <InfoPanel title="写真登録済みの場所" value={`${photoPins} / ${bundle.pins.length}`} />
        <InfoPanel title="チェックリスト" value={`${checked} / ${total}`} />
        <InfoPanel title="最終更新" value={formatDateTime(property.updatedAt)} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white"
          onClick={() => onChangeSection("floor")}
        >
          <MapPin aria-hidden size={18} />
          間取りと写真を記録
        </button>
        <button
          type="button"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-ledger-line px-4 font-bold text-ledger-primary"
          onClick={() => onChangeSection("export")}
        >
          <FileText aria-hidden size={18} />
          PDF保存へ進む
        </button>
      </div>
    </section>
  );
}

function FloorPlanSection({
  floorPlan,
  pins,
  photos,
  checklistItems,
  selectedPinId,
  busy,
  onUpload,
  onSelectPin,
  onAddPin,
  onMovePin,
  onAddPhoto,
  onDeletePhoto,
  onUpdateChecklist,
  onUpdatePin,
  onDeletePin
}: {
  floorPlan: FloorPlan | null;
  pins: FloorPlanPin[];
  photos: PhotoRecord[];
  checklistItems: ChecklistItem[];
  selectedPinId: string;
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
  onSelectPin: (pinId: string) => void;
  onAddPin: (point: { x: number; y: number }) => Promise<void>;
  onMovePin: (pinId: string, point: { x: number; y: number }) => Promise<void>;
  onAddPhoto: (input: {
    pinId: string;
    file: File;
    targetName: string;
    category: PhotoCategory;
    comment: string;
  }) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onUpdateChecklist: (itemId: string, patch: Partial<Pick<ChecklistItem, "isChecked" | "note">>) => Promise<void>;
  onUpdatePin: (pinId: string, placeName: string) => Promise<void>;
  onDeletePin: (pinId: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<PlanMode>("idle");
  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null;
  const selectedPinPhotos = photos.filter((photo) => photo.pinId === selectedPinId);
  const selectedPinChecklist = checklistItems.filter((item) => item.pinId === selectedPinId);

  const handleMapPoint = async (point: { x: number; y: number }) => {
    if (mode === "add") {
      await onAddPin(point);
      setMode("idle");
      return;
    }
    if (mode === "move" && selectedPin) {
      await onMovePin(selectedPin.id, point);
      setMode("idle");
    }
  };

  return (
    <section className="rounded-lg border border-ledger-line bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">間取りと場所別の記録</h2>
          <p className="mt-1 text-sm text-ledger-muted">PDFの1ページ目にピンを置き、選んだピンに写真と確認をまとめます。</p>
        </div>
        <label className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-ledger-line bg-white px-4 font-bold text-ledger-primary">
          <Upload aria-hidden size={20} />
          PDFを選択
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void onUpload(file);
            }}
          />
        </label>
      </div>

      {floorPlan ? (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-bold ${
                mode === "add" ? "bg-ledger-primary text-white" : "border border-ledger-line bg-white text-ledger-primary"
              }`}
              onClick={() => setMode(mode === "add" ? "idle" : "add")}
            >
              <Plus aria-hidden size={18} />
              ピン追加
            </button>
            <button
              type="button"
              className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 font-bold ${
                mode === "move" ? "bg-ledger-primary text-white" : "border border-ledger-line bg-white text-ledger-primary"
              } disabled:opacity-50`}
              onClick={() => setMode(mode === "move" ? "idle" : "move")}
              disabled={!selectedPin}
            >
              <Move aria-hidden size={18} />
              選択ピンを移動
            </button>
          </div>
          <p className="mt-3 text-sm text-ledger-muted">
            {mode === "add"
              ? "間取り図の位置をタップすると番号ピンを追加します。"
              : mode === "move"
                ? "移動先をタップすると選択中の番号ピンを移動します。"
                : "番号ピンを選ぶと場所名を入力できます。"}
          </p>
          <FloorPlanCanvas
            floorPlan={floorPlan}
            pins={pins}
            selectedPinId={selectedPinId}
            onSelectPin={onSelectPin}
            onMapPoint={handleMapPoint}
          />
          {pins.length > 0 ? (
            <>
              <PinTabs
                pins={pins}
                photos={photos}
                checklistItems={checklistItems}
                selectedPinId={selectedPinId}
                onSelectPin={onSelectPin}
              />
              {selectedPin ? (
                <PinDetailPanel
                  pin={selectedPin}
                  photos={selectedPinPhotos}
                  checklistItems={selectedPinChecklist}
                  busy={busy}
                  moving={mode === "move"}
                  onStartMove={() => setMode(mode === "move" ? "idle" : "move")}
                  onSavePlaceName={(placeName) => onUpdatePin(selectedPin.id, placeName)}
                  onDeletePin={() => onDeletePin(selectedPin.id)}
                  onAddPhoto={onAddPhoto}
                  onDeletePhoto={onDeletePhoto}
                  onUpdateChecklist={onUpdateChecklist}
                />
              ) : null}
            </>
          ) : (
            <p className="mt-4 rounded-md bg-ledger-paper p-4 text-sm text-ledger-muted">ピン追加を押して、間取り図の記録したい場所をタップしてください。</p>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-ledger-line bg-ledger-paper p-6 text-center text-sm text-ledger-muted">
          間取りPDFを選択すると、1ページ目を表示します。
        </div>
      )}

    </section>
  );
}

function FloorPlanCanvas({
  floorPlan,
  pins,
  selectedPinId,
  onSelectPin,
  onMapPoint
}: {
  floorPlan: FloorPlan;
  pins: FloorPlanPin[];
  selectedPinId: string;
  onSelectPin: (pinId: string) => void;
  onMapPoint: (point: { x: number; y: number }) => Promise<void>;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const observer = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      void renderFirstPdfPage(floorPlan.fileBlob, canvas, wrap.clientWidth)
        .then((result) => {
          setSize({ width: result.width, height: result.height });
          setError("");
        })
        .catch(() => setError("間取りPDFを表示できませんでした。"));
    });

    observer.observe(wrap);
    return () => observer.disconnect();
  }, [floorPlan.fileBlob]);

  const handlePointer = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    await onMapPoint({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    });
  };

  return (
    <div className="mt-4 overflow-x-auto rounded-md border border-ledger-line bg-slate-100 p-2" ref={wrapRef}>
      {error ? <p className="p-4 text-sm text-red-700">{error}</p> : null}
      <div className="relative inline-block max-w-full align-top" style={{ width: size.width || undefined, height: size.height || undefined }}>
        <canvas ref={canvasRef} className="block max-w-full" />
        <div className="absolute inset-0" onPointerDown={(event) => void handlePointer(event)}>
          {pins.map((pin) => (
            <button
              type="button"
              key={pin.id}
              className={`absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold text-white shadow ${
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
  checklistItems,
  selectedPinId,
  onSelectPin
}: {
  pins: FloorPlanPin[];
  photos: PhotoRecord[];
  checklistItems: ChecklistItem[];
  selectedPinId: string;
  onSelectPin: (pinId: string) => void;
}) {
  return (
    <div className="mt-5 overflow-x-auto pb-2">
      <div className="flex min-w-max gap-2">
        {pins.map((pin) => {
          const photoCount = photos.filter((photo) => photo.pinId === pin.id).length;
          const checks = checklistItems.filter((item) => item.pinId === pin.id);
          const checkedCount = checks.filter((item) => item.isChecked).length;
          const selected = selectedPinId === pin.id;

          return (
            <button
              type="button"
              key={pin.id}
              className={`min-h-20 w-44 rounded-md border p-3 text-left ${
                selected ? "border-ledger-primary bg-teal-50" : "border-ledger-line bg-white hover:bg-slate-50"
              }`}
              onClick={() => onSelectPin(pin.id)}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-bold text-ledger-primary">ピン {pin.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${photoCount > 0 ? "bg-teal-100 text-ledger-primary" : "bg-amber-100 text-amber-800"}`}>
                  写真 {photoCount}
                </span>
              </span>
              <span className="mt-1 block truncate text-sm">{pin.placeName || "場所名未入力"}</span>
              <span className="mt-2 flex gap-1 text-[11px] font-bold">
                <span className="rounded-full bg-ledger-paper px-2 py-0.5 text-ledger-muted">確認 {checkedCount}/{checks.length}</span>
                {!pin.placeName.trim() ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">名称未入力</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PinDetailPanel({
  pin,
  photos,
  checklistItems,
  busy,
  moving,
  onStartMove,
  onSavePlaceName,
  onDeletePin,
  onAddPhoto,
  onDeletePhoto,
  onUpdateChecklist
}: {
  pin: FloorPlanPin;
  photos: PhotoRecord[];
  checklistItems: ChecklistItem[];
  busy: boolean;
  moving: boolean;
  onStartMove: () => void;
  onSavePlaceName: (placeName: string) => Promise<void>;
  onDeletePin: () => Promise<void>;
  onAddPhoto: (input: {
    pinId: string;
    file: File;
    targetName: string;
    category: PhotoCategory;
    comment: string;
  }) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onUpdateChecklist: (itemId: string, patch: Partial<Pick<ChecklistItem, "isChecked" | "note">>) => Promise<void>;
}) {
  const [placeName, setPlaceName] = useState(pin.placeName);
  const [targetName, setTargetName] = useState("");
  const [category, setCategory] = useState<PhotoCategory>("壁");
  const [comment, setComment] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const checklistOrder = (label: string) => {
    const index = DEFAULT_PIN_CHECKLIST_ITEMS.indexOf(label as (typeof DEFAULT_PIN_CHECKLIST_ITEMS)[number]);
    return index === -1 ? DEFAULT_PIN_CHECKLIST_ITEMS.length : index;
  };
  const orderedChecklistItems = [...checklistItems].sort((a, b) => checklistOrder(a.label) - checklistOrder(b.label));

  useEffect(() => setPlaceName(pin.placeName), [pin.placeName]);
  useEffect(() => {
    setTargetName("");
    setComment("");
    setFile(null);
  }, [pin.id]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    await onAddPhoto({ pinId: pin.id, file, targetName, category, comment });
    setTargetName("");
    setComment("");
    setFile(null);
  };

  return (
    <div className="mt-4 rounded-md border border-ledger-line bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-bold">ピン {pin.label} の記録</h3>
          <p className="mt-1 text-sm text-ledger-muted">
            写真 {photos.length}枚 / 確認 {checklistItems.filter((item) => item.isChecked).length}/{checklistItems.length}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-bold ${
              moving ? "bg-ledger-primary text-white" : "border border-ledger-line text-ledger-primary"
            }`}
            onClick={onStartMove}
          >
            <Move aria-hidden size={16} />
            移動
          </button>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-bold text-red-700"
            onClick={() => void onDeletePin()}
          >
            <Trash2 aria-hidden size={16} />
            削除
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="flex-1 text-sm font-bold">
          場所名
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-ledger-line px-3 text-base"
            value={placeName}
            onChange={(event) => setPlaceName(event.target.value)}
            placeholder="例: リビングの窓"
          />
        </label>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white sm:self-end"
          onClick={() => void onSavePlaceName(placeName)}
        >
          <Save aria-hidden size={18} />
          保存
        </button>
      </div>

      <form className="mt-5 grid gap-3 rounded-md bg-ledger-paper p-4 sm:grid-cols-2" onSubmit={handleSubmit}>
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
            className="mt-1 min-h-12 w-full rounded-md border border-ledger-line bg-white px-3 text-base"
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
            onChange={(event) => setCategory(event.target.value as PhotoCategory)}
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
            className="mt-1 min-h-24 w-full rounded-md border border-ledger-line bg-white px-3 py-2 text-base"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="状態を短く記録します"
          />
        </label>
        <button
          type="submit"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50 sm:col-span-2"
          disabled={busy || !file}
        >
          <Camera aria-hidden size={20} />
          このピンに写真を追加
        </button>
      </form>

      <div className="mt-5 rounded-md border border-ledger-line p-3">
        <h4 className="flex items-center gap-2 font-bold">
          <CheckSquare aria-hidden size={18} />
          この場所の確認
        </h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {orderedChecklistItems.length === 0 ? <p className="text-sm text-ledger-muted">確認項目を準備中です。</p> : null}
          {orderedChecklistItems.map((item) => (
            <label key={item.id} className="flex min-h-11 items-center justify-between gap-3 rounded-md bg-ledger-paper px-3">
              <span>{item.label}</span>
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={item.isChecked}
                onChange={(event) => void onUpdateChecklist(item.id, { isChecked: event.target.checked })}
              />
            </label>
          ))}
        </div>
      </div>

      <PinPhotoList photos={photos} onDelete={onDeletePhoto} />
    </div>
  );
}

function PinPhotoList({
  photos,
  onDelete
}: {
  photos: PhotoRecord[];
  onDelete: (photoId: string) => Promise<void>;
}) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {photos.length === 0 ? <p className="text-sm text-ledger-muted">まだ写真がありません。</p> : null}
      {photos.map((photo) => (
        <article key={photo.id} className="rounded-md border border-ledger-line bg-white p-3">
          <BlobImage blob={photo.imageBlob} alt={photo.imageFileName} />
          <div className="mt-3 space-y-1 text-sm">
            <p className="font-bold">{photo.targetName || "撮影箇所未入力"}</p>
            <p className="text-ledger-muted">{photo.category}</p>
            <p>{photo.comment || "コメント未入力"}</p>
            <p className="text-xs text-ledger-muted">{formatDateTime(photo.takenAt)}</p>
          </div>
          <button
            type="button"
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-bold text-red-700"
            onClick={() => void onDelete(photo.id)}
          >
            <Trash2 aria-hidden size={16} />
            削除
          </button>
        </article>
      ))}
    </div>
  );
}

function BlobImage({ blob, alt }: { blob: Blob; alt: string }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const nextUrl = URL.createObjectURL(blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  return url ? <img src={url} alt={alt} className="h-44 w-full rounded-md object-cover" /> : null;
}

function ExportSection({
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

    await navigator.clipboard.writeText(`${SHARE_MAIL_SUBJECT}\n\n${SHARE_MAIL_BODY}`);
    alert("共有用の文面をコピーしました。PDF保存ボタンからファイルを保存してください。");
  };

  return (
    <section className="rounded-lg border border-ledger-line bg-white p-4">
      <h2 className="text-xl font-bold">PDF台帳出力</h2>
      <p className="mt-1 text-sm text-ledger-muted">表紙、間取り図、写真台帳をまとめたPDFを作成します。</p>
      <button
        type="button"
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-ledger-primary px-4 font-bold text-white disabled:opacity-50"
        onClick={() => void handleGenerate()}
        disabled={busy}
      >
        <FileText aria-hidden size={20} />
        PDF台帳を作成する
      </button>

      {pdfBlob ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
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
            共有する
          </button>
        </div>
      ) : null}

      <div className="mt-5 rounded-md bg-ledger-paper p-4">
        <h3 className="font-bold">共有用文面</h3>
        <pre className="mt-2 whitespace-pre-wrap text-sm leading-7 text-ledger-muted">{SHARE_MAIL_BODY}</pre>
      </div>

      <div className="mt-5">
        <h3 className="font-bold">出力履歴</h3>
        <div className="mt-2 space-y-2">
          {bundle.exportHistory.length === 0 ? <p className="text-sm text-ledger-muted">まだ出力履歴はありません。</p> : null}
          {bundle.exportHistory.map((history) => (
            <p key={history.id} className="rounded-md border border-ledger-line p-3 text-sm">
              {history.fileName}
              <span className="mt-1 block text-xs text-ledger-muted">{formatDateTime(history.exportedAt)}</span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptyState({ onSample }: { onSample: (layoutType: SampleLayoutType) => Promise<void> }) {
  return (
    <section className="rounded-lg border border-ledger-line bg-white p-8 text-center">
      <h2 className="text-2xl font-bold">最初の記録を作成します</h2>
      <p className="mt-3 leading-7 text-ledger-muted">
        物件を作成するか、一般的な間取りサンプルから試せます。サンプルには間取りPDFと番号ピンが入っています。
      </p>
      <SampleLayoutButtons onSample={onSample} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-ledger-paper px-3 py-4">
      <p className="text-2xl font-bold text-ledger-primary">{value}</p>
      <p className="mt-1 text-xs text-ledger-muted">{label}</p>
    </div>
  );
}

function InfoPanel({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-md border border-ledger-line p-4">
      <p className="text-xs font-bold text-ledger-muted">{title}</p>
      <p className="mt-2 break-words font-bold">{value}</p>
    </div>
  );
}

function Notice({ message }: { message: string }) {
  return <p className="rounded-md border border-teal-100 bg-teal-50 p-3 text-sm leading-6 text-ledger-primary">{message}</p>;
}

function StatusMessage({ message }: { message: string }) {
  return <p className="rounded-md border border-ledger-line bg-white p-3 text-sm text-ledger-muted">{message}</p>;
}
