import type { SummaryContent } from "@/lib/share-rules";
export default function SummarySnapshot({
  content,
}: {
  content: SummaryContent;
}) {
  return (
    <article className="summary-snapshot">
      <header>
        <span className="eyebrow">OWNER-SELECTED SNAPSHOT</span>
        <h2>{content.heading}</h2>
        <p>Captured {new Date(content.capturedAt).toLocaleString()}</p>
        {content.lastUpdated && (
          <p className="fine-print">
            Source history last updated{" "}
            {new Date(content.lastUpdated).toLocaleString()}
          </p>
        )}
      </header>
      {content.identity.length > 0 && (
        <dl className="snapshot-identity">
          {content.identity.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="snapshot-provenance">{content.provenance}</p>
      {content.sections.map((section) => (
        <section
          key={section.key}
          className={`snapshot-section ${section.key === "allergies" || section.key === "emergencyNotes" ? "important" : ""}`}
        >
          <h3>{section.title}</h3>
          {section.note && <p className="fine-print">{section.note}</p>}
          {section.items.length ? (
            section.items.map((item, index) => (
              <article key={index}>
                <h4>{item.title}</h4>
                <dl>
                  {item.fields.map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))
          ) : (
            <p className="muted">No entries included in this section.</p>
          )}
        </section>
      ))}
      <p className="snapshot-footnote">{content.omissionNotice}</p>
    </article>
  );
}
