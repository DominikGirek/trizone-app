/**
 * Curated PRO start lists ("fields") for tippable races that don't yet surface a live start list from the
 * athlete pipeline. Race-centric (like raceResults): each entry is the verified, ANNOUNCED pro field —
 * athlete slugs per gender, from the official start list / a reputable source. The Tipp picker builds its
 * pool from this when no live start list exists.
 *
 * HARD RULE (data-integrity): only real, entered athletes — never invent a field. Every slug must exist in
 * the roster (src/mocks/athletes.ts) so names render. `source` + `verifiedAt` are mandatory. A race whose
 * field isn't published yet simply stays "Startliste folgt".
 */
export interface TippableField {
  raceId: string;
  men: string[];
  women: string[];
  source: string;
  verifiedAt: string;
  /** True if the field is a pre-race provisional/tentative start list (may still change). */
  provisional?: boolean;
  /** True if only the ALREADY-QUALIFIED athletes are listed and the field still grows (e.g. Kona). */
  partial?: boolean;
}

export const tippableFields: TippableField[] = [
  {
    // T100 Vancouver is a WOMEN-only pro race in 2026; this is the published *tentative* field (refresh
    // closer to the race / via Tobi). Withdrawals just score 0; the podium contenders are all on it.
    raceId: 'se-t100-vancouver',
    men: [],
    women: [
      'alanis-siffert', 'nicole-van-der-kaay', 'taylor-spivey', 'sara-perez-sala', 'holly-lawrence',
      'lotte-wilms', 'daniela-kleiser', 'lizzie-rayner', 'ellie-salthouse', 'hanne-de-vet',
      'audrey-merle', 'hannah-berry', 'lisa-perterer', 'marjolaine-pierre', 'rebecca-anderbury',
      'leana-bissig', 'grace-alexander',
    ],
    source: 'stats.protriathletes.org/race/vancouver-t100/2026/participants (tentative)',
    verifiedAt: '2026-06-28',
    provisional: true,
  },
  {
    // IRONMAN World Championship Kona 2026 — single-day, BOTH genders. Only the already-QUALIFIED pros
    // (TriRating qualification tracker); the field keeps growing through the season, so partial=true.
    raceId: 'se-im-worlds-kona',
    men: [
      'kristian-blummenfelt', 'gustav-iden', 'sam-laidlow', 'leonard-arnold', 'marius-bjerkeset',
      'casper-stornes', 'rasmus-svenningsson', 'cameron-wurf', 'ben-kanute', 'menno-koolhaas',
      'sam-long', 'almog-elazary', 'arthur-horseau', 'sebastian-norberg', 'michele-sarzilla',
      'jumpei-furuya', 'cameron-main', 'caleb-noble', 'nick-thompson', 'trevor-foley', 'matt-hanson',
      'pierre-le-corre', 'jack-moody', 'brock-hoel', 'kieran-lindars', 'vincent-luis', 'jonas-schomburg',
      'marten-van-riel', 'rudy-von-berg', 'florian-angert', 'matthew-marquardt', 'tristan-olij',
      'mikel-ugarte-ramos', 'patrick-lange', 'damien-le-mesnager', 'jordi-montraveta-moya',
      'arnaud-guilloux', 'wilhelm-hirsch', 'youri-keulen', 'benjamin-hill', 'jarrod-osborne',
      'jon-saeveras-breivold', 'mattia-ceccarelli', 'antonio-benito-lopez', 'magnus-ditlev',
      'nathan-guerbeur', 'jamie-riddle', 'kacper-stepniak', 'jan-stratmann',
    ],
    women: [
      'chelsea-sodaro', 'lucy-charles-barclay', 'franzi-hofmann', 'rosie-wild', 'danielle-fauteux',
      'anna-pabinger', 'solveig-lovseth', 'alice-alberts', 'elisabetta-curridori', 'rachel-zilinskas',
      'arlette-mariana-gonzalez-hurtado', 'marta-lagownik', 'danielle-lewis', 'sara-svensk', 'kate-curran',
      'charlotte-mcshane', 'anne-sophie-pierre', 'lotte-wilms', 'hannah-berry', 'regan-hollioake',
      'tamara-jewett', 'kat-matthews', 'jackie-hering', 'taylor-knibb', 'gabrielle-lumkes', 'marta-sanchez',
      'grace-thek', 'jana-uderstadt', 'daniela-bleymehl', 'daisy-davies', 'katrine-graesboll-christensen',
      'henrike-gueber', 'rebecca-anderbury', 'nina-derron', 'nikita-paskiewiez', 'romina-biagioli',
      'julie-iemmolo', 'pamella-oliveira', 'kaidi-kivioja', 'fenella-langridge', 'india-lee',
      'lisa-perterer', 'laura-philipp', 'marjolaine-pierre', 'penny-slater', 'skye-wallace',
    ],
    source: 'trirating.com/kona-2026 (qualified so far)',
    verifiedAt: '2026-06-28',
    partial: true,
  },
  {
    // IRONMAN 70.3 World Championship 2026 (Nice, Sep 12/13) — the qualified pros. Many decline the slot
    // (Kona priority), so the actual field shrinks → provisional.
    raceId: 'se-im703-wc-nice',
    men: [
      'gustav-iden', 'kristian-blummenfelt', 'rico-bogen', 'samuel-dickinson', 'fabian-kraft',
      'gabriel-sandoer', 'leon-chevalier', 'harry-palmer', 'quentin-barreau', 'fernando-toldi',
      'sam-appleton', 'justin-riele', 'maximilian-sperl', 'kacper-stepniak', 'josh-ferris',
      'mike-phillips', 'reinaldo-colucci', 'andre-lopes', 'michele-bortolamedi', 'joran-driesen',
      'ben-kanute', 'jason-west', 'henry-raeppo', 'james-teagle', 'gregor-payet', 'nick-thompson',
      'vicente-hernandez', 'valdemar-solok', 'dieter-comhair', 'cameron-main', 'trevor-foley',
      'luke-jones', 'jake-birtwhistle', 'yoann-colin', 'adrien-briffod', 'valentin-rouvier',
      'manoel-messias-dos-santos', 'luciano-taccone', 'rodrigo-gonzalez', 'emmanuel-lejeune', 'ari-klau',
      'kevin-mcdowell', 'joao-ferreira', 'yago-rodrigues-santos-alves', 'federico-scarabino',
      'tyler-mislawchuk', 'jens-emil-nielsen', 'jelle-geens', 'colin-szuch', 'filipe-azevedo',
      'vincent-luis', 'blake-harris', 'lionel-sanders', 'martin-baeza-munoz', 'cenzino-lebot',
      'casimir-moine', 'enzo-krauss', 'andrea-salvisberg', 'jannik-schaufler', 'kurt-mcdonald',
      'jarrod-osborne', 'hayden-wilde', 'sam-long', 'jonas-schomburg', 'casper-stornes', 'marcel-bolbat',
      'sam-laidlow', 'lasse-nygaard-priester', 'jonathan-guisolan', 'matheus-menezes', 'trent-thorpe',
      'marc-dubrick', 'seth-rider', 'felix-forissier', 'nathan-guerbeur', 'simon-viain', 'nicholas-holmes',
      'jeremy-maclean', 'simon-shi', 'cedric-osterholt', 'simon-westermann', 'matthew-mcgoey',
      'morgan-pearson', 'rasmus-svenningsson', 'zachary-bernier-michaud', 'david-reynolds', 'ben-faeh',
      'jamie-riddle', 'marten-van-riel',
    ],
    women: [
      'taylor-knibb', 'lena-meissner', 'caroline-pohle', 'natalie-van-coevorden', 'rebecca-anderbury',
      'kat-matthews', 'elizabeth-bravo', 'lirany-gutierrez', 'paula-findlay', 'danielle-lewis',
      'katrine-graesboll-christensen', 'megan-mcdonald', 'sophie-malowiecki', 'amelia-watkinson',
      'julie-iemmolo', 'pamella-oliveira', 'bianca-bogen', 'lisa-maria-dornauer', 'caroline-kaplan',
      'gabrielle-lumkes', 'diede-diederiks', 'kaidi-kivioja', 'solveig-lovseth', 'lisa-perterer',
      'agnieszka-gadomska', 'franzi-hofmann', 'justine-mathieux', 'bridget-theunissen', 'jackie-hering',
      'tamara-jewett', 'ellie-salthouse', 'lotte-wilms', 'djenyfer-arnold', 'vittoria-lopes',
      'kelly-barton', 'cecilia-perez', 'grace-alexander', 'lydia-russell', 'kate-curran', 'lizzie-rayner',
      'romina-biagioli', 'laura-mathews', 'raquel-rocha', 'julie-derron', 'justine-guerard',
      'lucy-charles-barclay', 'nikita-paskiewiez', 'pietra-picolo-meneghini', 'georgia-taylor-brown',
      'kirsten-kasper', 'amelie-kretz', 'francisca-garrido', 'macarena-salazar-ezquerra', 'bruna-stolf',
      'giovanna-alves-opipari', 'anna-buettner', 'annamarie-strehlow', 'penny-slater', 'grace-thek',
      'skye-wallace', 'audrey-merle', 'marta-sanchez', 'diana-castillo-franco', 'sophie-evans',
      'cathia-schaer', 'sarah-schoenfelder', 'kayla-bowker', 'regan-hollioake', 'shiva-leisner',
      'ekaterina-shabalina', 'laura-philipp', 'marjolaine-pierre', 'imogen-simmonds', 'megan-foley',
      'adele-likin', 'alanis-siffert', 'daniela-kleiser', 'hannah-berry', 'jenna-campbell',
      'kristen-marchant', 'lisa-becharas', 'aurelia-boulanger', 'leana-bissig', 'hanne-de-vet',
      'fenella-langridge',
    ],
    source: 'trirating.com/70.3-world-championships-2026 (qualified — many decline)',
    verifiedAt: '2026-06-28',
    provisional: true,
  },
];

const byId: Record<string, TippableField> = Object.fromEntries(tippableFields.map((f) => [f.raceId, f]));

/** Curated pro field for a race, or undefined if none is curated. */
export function getTippableField(raceId: string): TippableField | undefined {
  return byId[raceId];
}

/** Race ids that have a curated field (for the funnel's "tippable now" check). */
export function curatedFieldIds(): string[] {
  return tippableFields.map((f) => f.raceId);
}
