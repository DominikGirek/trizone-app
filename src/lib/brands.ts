/**
 * Curated registry of triathlon brands the user can "follow".
 * Each brand has headline-matching keywords (word-bounded, with disambiguation
 * for collision-prone names like "On"). Used by the Following hub and by the
 * "For you" news ranking (relevanceOf). No fabrication — we only match real
 * brand mentions in real article titles/summaries.
 */
export interface Brand {
  id: string;
  name: string;
  emoji: string;
  keywords: RegExp;
}

export const BRANDS: Brand[] = [
  // Bikes
  { id: 'canyon', name: 'Canyon', emoji: '🚲', keywords: /\bcanyon\b/i },
  { id: 'cervelo', name: 'Cervélo', emoji: '🚲', keywords: /\bcerv[ée]lo\b/i },
  { id: 'specialized', name: 'Specialized', emoji: '🚲', keywords: /\bspecialized\b/i },
  { id: 'trek', name: 'Trek', emoji: '🚲', keywords: /\btrek bik|\btrek (madone|speed concept)\b/i },
  { id: 'cube', name: 'Cube', emoji: '🚲', keywords: /\bcube (bike|aerium|triathlon)\b/i },
  { id: 'bmc', name: 'BMC', emoji: '🚲', keywords: /\bbmc\b/i },
  { id: 'scott', name: 'Scott', emoji: '🚲', keywords: /\bscott (plasma|bike|sports)\b/i },
  // Apparel
  { id: 'ryzon', name: 'Ryzon', emoji: '👕', keywords: /\bryzon\b/i },
  { id: '2xu', name: '2XU', emoji: '👕', keywords: /\b2xu\b/i },
  { id: 'santini', name: 'Santini', emoji: '👕', keywords: /\bsantini\b/i },
  { id: 'incylence', name: 'INCYLENCE', emoji: '🧦', keywords: /\bincylence\b/i },
  { id: 'saysky', name: 'SAYSKY', emoji: '👕', keywords: /\bsaysky\b/i },
  { id: 'danishendurance', name: 'Danish Endurance', emoji: '🧦', keywords: /\bdanish endurance\b/i },
  // Swim / wetsuits
  { id: 'zone3', name: 'Zone3', emoji: '🥽', keywords: /\bzone ?3\b/i },
  { id: 'huub', name: 'HUUB', emoji: '🥽', keywords: /\bhuub\b/i },
  { id: 'orca', name: 'Orca', emoji: '🥽', keywords: /\borca\b/i },
  { id: 'roka', name: 'ROKA', emoji: '🥽', keywords: /\broka\b/i },
  { id: 'sailfish', name: 'sailfish', emoji: '🥽', keywords: /\bsailfish\b/i },
  // Run shoes
  { id: 'hoka', name: 'HOKA', emoji: '👟', keywords: /\bhoka\b/i },
  { id: 'on', name: 'On Running', emoji: '👟', keywords: /\bon running\b|\bon cloud/i },
  { id: 'asics', name: 'ASICS', emoji: '👟', keywords: /\basics\b/i },
  { id: 'saucony', name: 'Saucony', emoji: '👟', keywords: /\bsaucony\b/i },
  { id: 'nike', name: 'Nike', emoji: '👟', keywords: /\bnike\b/i },
  { id: 'currex', name: 'currex', emoji: '👟', keywords: /\bcurrex\b/i },
  { id: 'top4running', name: 'top4running', emoji: '👟', keywords: /\btop4running\b/i },
  // Electronics
  { id: 'garmin', name: 'Garmin', emoji: '⌚', keywords: /\bgarmin\b/i },
  { id: 'wahoo', name: 'Wahoo', emoji: '⌚', keywords: /\bwahoo\b/i },
  { id: 'polar', name: 'Polar', emoji: '⌚', keywords: /\bpolar (vantage|grit|pacer|flow)\b/i },
  { id: 'shokz', name: 'Shokz', emoji: '🎧', keywords: /\bshokz\b/i },
  // Nutrition
  { id: 'maurten', name: 'Maurten', emoji: '🧪', keywords: /\bmaurten\b/i },
  { id: 'precision', name: 'Precision Fuel', emoji: '🧪', keywords: /\bprecision (fuel|hydration)\b/i },
  { id: 'ag1', name: 'AG1', emoji: '🥤', keywords: /\bag1\b|athletic greens/i },
  { id: 'styrkr', name: 'STYRKR', emoji: '🧪', keywords: /\bstyrkr\b/i },
  { id: 'mnstry', name: 'MNSTRY', emoji: '🧪', keywords: /\bmnstry\b/i },
  { id: 'ancientbrave', name: 'Ancient + Brave', emoji: '🌿', keywords: /\bancient ?\+? ?(and )?brave\b/i },
  { id: '3bears', name: '3Bears', emoji: '🥣', keywords: /\b3bears\b/i },
  // Recovery / other
  { id: 'reboots', name: 'Reboots', emoji: '🦵', keywords: /\breboots\b/i },
  { id: 'blackroll', name: 'BLACKROLL', emoji: '🧘', keywords: /\bblackroll\b/i },
  // Weitere Podcast-Sponsoren (Lauf / Tri / Trail)
  { id: 'dextro', name: 'Dextro Energy', emoji: '🧪', keywords: /\bdextro( energy)?\b/i },
  { id: 'pillar', name: 'PILLAR Performance', emoji: '🧪', keywords: /\bpillar performance\b/i },
  { id: 'getbetter', name: 'GET BETTER', emoji: '🧪', keywords: /\bget better\b/i },
  { id: 'koro', name: 'KoRo', emoji: '🥜', keywords: /\bkoro\b/i },
  { id: 'loewenanteil', name: 'Löwenanteil', emoji: '🥜', keywords: /\blöwenanteil\b/i },
  { id: 'cep', name: 'CEP', emoji: '👕', keywords: /\bcep (sports|compression)\b/i },
  { id: 'truemotion', name: 'True Motion', emoji: '👟', keywords: /\btrue motion\b/i },
  { id: 'feelslike', name: 'feels.like', emoji: '🧴', keywords: /\bfeels ?like\b/i },
  { id: 'core', name: 'CORE', emoji: '🌡️', keywords: /\bcore body temp|coretemp\b/i },
  { id: 'greaze', name: 'GREAZE', emoji: '🚲', keywords: /\bgreaze\b/i },
  // Rennrad-Podcast-Sponsoren
  { id: 'keego', name: 'KEEGO', emoji: '🍶', keywords: /\bkeego\b/i },
  { id: 'vekolo', name: 'Vekolo', emoji: '🚴', keywords: /\bvekolo\b/i },
  { id: 'schaltauge', name: 'Schaltauge24', emoji: '🔧', keywords: /\bschaltauge\b/i },
];

export const brandsById: Record<string, Brand> = Object.fromEntries(
  BRANDS.map((b) => [b.id, b]),
);
