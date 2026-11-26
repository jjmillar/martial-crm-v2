import { splitSkills, type SkillLike } from './skills'

/**
 * A student's skills (portal Inicio and public profile): first Gi vs NoGi in one split bar (share of training of each),
 * then every other skill with its share of the total of those skills (bar + %).
 */
export function SkillsBreakdown<T extends SkillLike>({ skills, own, emptyText }: { skills: T[]; own: boolean; emptyText: string }) {
  const s = splitSkills(skills)
  const hasGi = s.giTotal > 0
  if (!hasGi && s.others.length === 0) return <p className="hint">{emptyText}</p>
  const giPct = s.gi?.pct ?? 0
  const nogiPct = s.nogi?.pct ?? 0

  return (
    <div className="skillset">
      {(hasGi || own) && (
        <section className="ginogi" aria-labelledby="ginogi-h">
          <h3 id="ginogi-h" className="skillset__title">Gi vs NoGi</h3>
          {hasGi ? (
            <>
              <div className="ginogi__labels">
                <span className="ginogi__side ginogi__side--gi"><i aria-hidden="true" />Gi <b>{giPct}%</b></span>
                <span className="ginogi__side ginogi__side--nogi"><b>{nogiPct}%</b> NoGi<i aria-hidden="true" /></span>
              </div>
              <div className="ginogi__bar" role="img" aria-label={`Gi ${giPct} %, NoGi ${nogiPct} %`}>
                {giPct > 0 && <span className="ginogi__gi" style={{ width: `${giPct}%` }} />}
                {nogiPct > 0 && <span className="ginogi__nogi" style={{ width: `${nogiPct}%` }} />}
              </div>
            </>
          ) : (
            <>
              <div className="ginogi__bar is-empty" aria-hidden="true" />
              <p className="hint">Se llena cuando entrenes clases con la skill Gi o NoGi.</p>
            </>
          )}
        </section>
      )}

      {s.others.length > 0 && (
        <section className="skillset__others" aria-labelledby="skills-others-h">
          <h3 id="skills-others-h" className="skillset__title">Skills</h3>
          <ul className="skills">
            {s.others.map((k) => (
              <li key={k.label}>
                <span className="skills__name">{k.icon ? `${k.icon} ` : ''}{k.label}</span>
                <span className="skills__pct">{k.pct}%</span>
                <span className="skills__bar" role="img" aria-label={`${k.label}: ${k.pct} %`}><span style={{ width: `${Math.max(k.pct, 3)}%` }} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
