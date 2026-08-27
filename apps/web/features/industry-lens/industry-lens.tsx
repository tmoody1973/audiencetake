import { citationText, createCitationLabels } from "../scout-card/citation-labels";
import type { ScoutCard } from "../scout-card/types";

function List({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return <p className="lens-empty">{empty}</p>;
  return <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

function LensToggleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16" /><path className="lens-toggle-vertical" d="M12 4v16" /></svg>;
}

export function IndustryLens({ card }: { card: ScoutCard }) {
  const citations = createCitationLabels(card.sourceLedger);

  return (
    <section className="industry-lens" aria-labelledby="industry-lens-title">
      <details>
        <summary>
          <span className="lens-toggle"><LensToggleIcon /></span>
          <span id="industry-lens-title">Industry Lens — comparative view</span>
          <small>Expand evidence matrix</small>
        </summary>
        <div className="lens-disclosure">
          <p>This comparison organizes cited evidence and bounded hypotheses. It is not a forecast, endorsement, or acquisition recommendation.</p>
          <div className="provenance-key" aria-label="Evidence provenance key">
            <span data-origin="submitted">Submitted source</span>
            <span data-origin="parallel">Parallel discovery</span>
            <span data-origin="inference">Inference</span>
            <span data-origin="external">External signal</span>
          </div>
        </div>
        <div className="lens-table-wrap" tabIndex={0} aria-label="Scrollable pathway comparison">
          <table className="lens-table">
            <caption className="sr-only">Industry Lens comparison of the three pathway hypotheses</caption>
            <thead>
              <tr>
                <th scope="col">Comparison</th>
                {card.pathways.map((pathway) => <th scope="col" key={pathway.id}><span>{String(pathway.order).padStart(2, "0")}</span>{pathway.label}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Audience / format</th>
                {card.pathways.map((pathway) => <td key={pathway.id}><strong>{pathway.format}</strong><p>{pathway.audience}</p></td>)}
              </tr>
              <tr>
                <th scope="row">Evidence cited</th>
                {card.pathways.map((pathway) => <td key={pathway.id}><span className="source-origin source-origin-inference">Inference</span><p>{citationText(pathway.supportingClaimIds.flatMap((claimId) => card.evidenceClaims.find((claim) => claim.id === claimId)?.sourceIds ?? []), citations)}</p></td>)}
              </tr>
              <tr>
                <th scope="row">Risks / questions</th>
                {card.pathways.map((pathway) => <td key={pathway.id}><List items={[...pathway.risks, ...pathway.openQuestions]} empty="Not supplied." /></td>)}
              </tr>
              <tr>
                <th scope="row">Signal limits</th>
                {card.pathways.map((pathway) => <td key={pathway.id}><List items={card.industryLens.signalLimitations} empty="No limitations supplied." /></td>)}
              </tr>
              <tr>
                <th scope="row">Creator claim</th>
                {card.pathways.map((pathway) => <td key={pathway.id}><strong>{card.industryLens.creatorClaimStatus} by creator</strong></td>)}
              </tr>
              <tr>
                <th scope="row">Next experiment</th>
                {card.pathways.map((pathway) => <td key={pathway.id}><strong>{pathway.nextExperiment.title}</strong><p>{pathway.nextExperiment.method}</p><small>Timebox: {pathway.nextExperiment.timebox}</small></td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="lens-notes">
          <div><h3>Cross-pathway risks</h3><List items={card.industryLens.risks} empty="No risks supplied." /></div>
          <div><h3>Unresolved questions</h3><List items={card.industryLens.unresolvedQuestions} empty="No questions supplied." /></div>
          <div><h3>Comparables</h3>{card.industryLens.comparables.length ? card.industryLens.comparables.map((item) => <div key={item.title}><strong>{item.title}</strong><p>{item.relevance}</p></div>) : <p className="lens-empty">No verified comparables were published for this card.</p>}</div>
        </div>
      </details>
    </section>
  );
}
