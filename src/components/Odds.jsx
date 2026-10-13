// Les raretés et leurs taux d'obtention, affichés en toute transparence.
import { fmt, fmtPct } from '../lib/format.js';
import { useSession } from '../lib/session.jsx';
import { Pips, RARITY } from '../lib/visuals.jsx';
import { Modal } from './ui.jsx';

export function RarityLadder({ compact = false }) {
  const { rules } = useSession();
  return (
    <ol className="flex flex-col gap-1.5">
      {[...rules.rarities].reverse().map((r) => (
        <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-3 py-2">
          <span className="grid h-8 min-w-8 flex-none place-items-center rounded-xl px-2 text-[11px]" style={{ color: RARITY[r.id].color, background: `${RARITY[r.id].color}1f` }}>
            <Pips rarity={r.id} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-bold" style={{ color: RARITY[r.id].color }}>
              {r.label}
            </span>
            <span className="block text-[12px] text-faint">{r.min ? `${fmt(r.min)} vues ou plus en 30 jours` : 'moins de 50 vues en 30 jours'}</span>
          </span>
          {!compact ? <span className="tnum text-[12.5px] text-muted">{fmtPct(r.share)}</span> : null}
        </li>
      ))}
    </ol>
  );
}

export function OddsModal({ open, onClose }) {
  const { rules } = useSession();
  const featured = new Map(rules.featuredOdds);
  return (
    <Modal open={open} onClose={onClose} className="max-w-[640px] p-5 sm:p-7" label="Taux d’obtention">
      <h2 className="text-[22px] font-extrabold tracking-[-.02em]">Taux d’obtention</h2>
      <p className="mt-1.5 pr-8 text-[14px] text-muted">
        Comme dans WikiMasters, la rareté d’une carte vient du nombre de vues de son article sur 30 jours et reste figée dès le premier tirage. Chaque booster
        contient {rules.packSize} cartes : les 4 premières suivent les proportions du catalogue, la 5ᵉ est toujours Rare ou mieux.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[480px] text-left text-[13.5px]">
          <thead className="text-[11.5px] tracking-[.08em] text-faint uppercase">
            <tr>
              <th className="py-2 font-bold">Rareté</th>
              <th className="py-2 font-bold">Vues / 30 j</th>
              <th className="py-2 text-right font-bold">Cartes 1 à 4</th>
              <th className="py-2 text-right font-bold">Carte 5</th>
              <th className="py-2 text-right font-bold">Meilleure stat</th>
            </tr>
          </thead>
          <tbody>
            {[...rules.rarities].reverse().map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-2.5 font-bold" style={{ color: RARITY[r.id].color }}>
                  <span className="inline-flex items-center gap-2">
                    <Pips rarity={r.id} /> {r.label}
                  </span>
                </td>
                <td className="tnum py-2.5 text-muted">{r.min ? `≥ ${fmt(r.min)}` : '< 50'}</td>
                <td className="tnum py-2.5 text-right">{fmtPct(r.share)}</td>
                <td className="tnum py-2.5 text-right">{fmtPct(featured.get(r.id) ?? 0)}</td>
                <td className="tnum py-2.5 text-right text-muted">
                  {fmt(r.stat[0])} à {fmt(r.stat[1])}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 rounded-2xl bg-[linear-gradient(90deg,rgb(255_143_216/.12),rgb(124_200_255/.12))] p-3 text-[13.5px] text-muted">
        <b className="text-text">Shiny</b> : chaque carte a {fmtPct(rules.shinyRate)} de chances de sortir en version Shiny, avec des reflets arc-en-ciel et
        une meilleure statistique au-dessus de sa fourchette (jusqu’à 15 000 pour une Légendaire).
      </p>
      <p className="mt-3 text-[12.5px] text-faint">
        ATK vient de la longueur de l’article, DEF de sa qualité (langues, labels). La plus haute des deux tombe dans la fourchette de la rareté, l’autre vaut au
        moins la moitié.
      </p>
    </Modal>
  );
}
