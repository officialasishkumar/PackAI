export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">PackSnap</p>
        <h1>Turn one luggage photo into a repacking checklist.</h1>
        <p className="lede">
          The full trip flow is coming next: upload media, extract visible items
          with Gemini, and keep an offline-friendly return-trip checklist.
        </p>
      </section>
      <section className="panel">
        <div>
          <p className="panel-label">Current status</p>
          <h2>Frontend and backend scaffolds are live.</h2>
        </div>
        <p className="panel-copy">
          Use this page as the integration checkpoint while the trip creation,
          Mongo persistence, and AI extraction layers are wired up.
        </p>
      </section>
    </main>
  );
}
