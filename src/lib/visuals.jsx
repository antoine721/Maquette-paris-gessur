// Apparence des raretés, des familles et des boosters (les règles elles-mêmes viennent du serveur).
import {
  Atom,
  BookOpen,
  FilmSlate,
  GlobeHemisphereWest,
  Leaf,
  MapPin,
  Scroll,
  SoccerBall,
  User,
  UserCircle,
  Diamond,
  Star,
  Crown,
} from '@phosphor-icons/react';

export const RARITY = [
  { key: 'commune', label: 'Commune', color: '#8e9ab5', glow: '#e8ecf4' },
  { key: 'peu-commune', label: 'Peu commune', color: '#2fbf71', glow: '#b8f5d3' },
  { key: 'rare', label: 'Rare', color: '#3d8bff', glow: '#c2dcff' },
  { key: 'super-rare', label: 'Super rare', color: '#e85bc7', glow: '#ffd0f1' },
  { key: 'ultra-rare', label: 'Ultra rare', color: '#ff7a2e', glow: '#ffd3b8' },
  { key: 'legendaire', label: 'Légendaire', color: '#ffd23f', glow: '#fff3c4' },
];

export const SHINY_COLORS = ['#ff8fd8', '#ffd36b', '#8affc8', '#7cc8ff', '#c39bff', '#ffffff'];

// Pastilles de rareté, à la manière des losanges et étoiles du TCG Pocket.
export function Pips({ rarity, className = '' }) {
  const items =
    rarity <= 3
      ? Array.from({ length: rarity + 1 }, (_, i) => <Diamond key={i} weight="fill" />)
      : rarity === 4
        ? [<Star key="a" weight="fill" />, <Star key="b" weight="fill" />]
        : [<Crown key="c" weight="fill" />];
  return (
    <span className={`inline-flex gap-[0.15em] ${className}`} aria-label={RARITY[rarity].label}>
      {items}
    </span>
  );
}

export const TYPE = {
  personnalite: { label: 'Personnalité', color: '#ff8a65', Icon: User },
  lieu: { label: 'Lieu', color: '#38b6ff', Icon: MapPin },
  nature: { label: 'Nature', color: '#4caf6a', Icon: Leaf },
  culture: { label: 'Culture', color: '#e05bc9', Icon: FilmSlate },
  sport: { label: 'Sport', color: '#ff9f1c', Icon: SoccerBall },
  histoire: { label: 'Histoire', color: '#b08a55', Icon: Scroll },
  sciences: { label: 'Sciences', color: '#6c7bff', Icon: Atom },
  savoir: { label: 'Savoir', color: '#8a97a8', Icon: BookOpen },
};
export const typeOf = (key) => TYPE[key] ?? TYPE.savoir;

export const PACK_LOOK = {
  encyclopedie: { c1: '#3b2bd0', c2: '#b63fb0', c3: '#ff9f43', emblem: null },
  personnalites: { c1: '#c2185b', c2: '#ff6f61', c3: '#ffc371', Icon: UserCircle },
  monde: { c1: '#0d47a1', c2: '#0097a7', c3: '#7ee8c7', Icon: GlobeHemisphereWest },
  nature: { c1: '#1b5e20', c2: '#43a047', c3: '#d4e157', Icon: Leaf },
  culture: { c1: '#4a148c', c2: '#d81b60', c3: '#ffb74d', Icon: FilmSlate },
  savoirs: { c1: '#1a237e', c2: '#3949ab', c3: '#4dd0e1', Icon: Atom },
};
