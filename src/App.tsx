export function App() {
  return (
    <main className="min-h-screen bg-ledger-paper text-ledger-ink">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-5 py-10">
        <p className="mb-3 text-sm font-bold text-ledger-primary">賃貸写真台帳メーカー</p>
        <h1 className="text-3xl font-bold leading-tight text-ledger-ink">
          部屋の状態を、写真と間取り図で整理します
        </h1>
        <p className="mt-5 text-base leading-8 text-ledger-muted">
          入居時・退去時の部屋の状態を、間取り図・写真・コメントで整理して残すためのアプリです。
        </p>
        <p className="mt-6 rounded border border-ledger-line bg-white p-4 text-sm leading-7 text-ledger-muted">
          このアプリは法律判断を行いません。部屋の状態を記録・整理することを目的としています。
        </p>
      </section>
    </main>
  );
}
