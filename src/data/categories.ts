// ---------------------------------------------------------------
// categories.ts
// ONE place that describes every category on the site.
//
// Each category says:
//   - which data it uses (bundled JSON; replaced by server data when online)
//   - which words in a search should point to it (keywords)
//   - which filters to show on the results page
//   - how to sort results
//   - what to show on each result card (describe)
//
// To add a new category later (e.g. "Hospitals"), you only need to
// add a JSON file, a type in shared/types.ts and one object below.
// ---------------------------------------------------------------

import type {
  BaseItem,
  CategoryId,
  College,
  School,
  Pg,
  Gym,
  FoodPlace,
  Rental,
  Place,
  Showroom,
  EventItem,
  Nirf,
} from '../../shared/types'
import colleges from './colleges.json'
import schools from './schools.json'
import pgs from './pgs.json'
import gyms from './gyms.json'
import food from './food.json'
import rentals from './rentals.json'
import places from './places.json'
import showrooms from './showrooms.json'
import events from './events.json'

// ---- Types for the config itself ---------------------------------
/*
  FILTER TYPES:
    'multi'     -> checkboxes. Item matches if its field equals (or, for
                   arrays, contains) ANY ticked option.
    'minRating' -> buttons: Any, 3+, 3.5+, 4+, 4.5+
    'max'       -> slider: item's number must be <= the chosen value
    'toggle'    -> one checkbox: item's field must be true (or pass `test`)

  "aliases" let the search box pick a filter option from casual words.
  Example: typing "girls pg" ticks the "Girls" option automatically.
*/
interface FilterBase {
  key: string
  label: string
  field: string
}
export interface MultiFilter extends FilterBase {
  type: 'multi'
  aliases?: Record<string, string[]>
  /** Don't match the option's own name in searches, only its aliases */
  aliasesOnly?: boolean
}
export interface ToggleFilter extends FilterBase {
  type: 'toggle'
  aliases?: string[]
  test?: (value: unknown) => boolean
}
export interface MinRatingFilter extends FilterBase {
  type: 'minRating'
}
export interface MaxFilter extends FilterBase {
  type: 'max'
  step: number
  format: (n: number) => string
}
export type FilterDef = MultiFilter | ToggleFilter | MinRatingFilter | MaxFilter

export interface SortDef {
  key: string
  label: string
  field: string
  dir: 'asc' | 'desc'
}

export interface Description {
  subtitle: string
  facts: [label: string, value: string][]
  tags: string[]
}

export interface Category<T extends BaseItem = BaseItem> {
  id: CategoryId
  name: string
  /** Shorter name for the category row in the top bar (falls back to `name`) */
  short?: string
  group: 'Study' | 'Live' | 'Move' | 'See'
  blurb: string
  data: T[]
  keywords: string[]
  /** Default minutes spent at a listing in the day planner */
  visitMins: number
  /** Field used for "Similar ..." on detail pages */
  similarBy?: string
  filters: FilterDef[]
  sorts: SortDef[]
  describe: (item: T) => Description
}

// Each category is written with its own item type (College, Pg ...)
// so describe() is fully checked. Stored together they share BaseItem.
const define = <T extends BaseItem>(c: Category<T>) => c as unknown as Category

// Read any field by name: field(item, 'rentPerMonth')
export const field = (item: BaseItem, key: string): unknown => (item as unknown as Record<string, unknown>)[key]

// ---- Small formatting helpers ------------------------------------

// 250000 -> "₹2,50,000" (Indian number format)
export const rupees = (n: number) => '₹' + Number(n).toLocaleString('en-IN')

// Like rupees(), but for prices we might not know (null).
// We never guess a price: unknown ones say so.
export const price = (n: number | null | undefined, suffix = '', unknown = 'Not published') =>
  n == null ? unknown : rupees(n) + suffix

// NIRF rank as text: "#2 in Management", "101–150 in Engineering"
export const nirfText = (nirf: Nirf | null) => {
  if (!nirf) return 'No rank on file'
  const isNumber = /^\d+$/.test(nirf.rank)
  return `${isNumber ? '#' + nirf.rank : nirf.rank} in ${nirf.category}`
}

// "2026-10-11" -> "11 Oct 2026"
export const prettyDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// Metro walk as text: "Jayanagar metro, about 6 min walk"
export const metroText = (item: BaseItem) =>
  item.nearestMetro && item.metroWalkMins != null
    ? `${item.nearestMetro}, about ${item.metroWalkMins} min walk`
    : 'No station nearby'

// Shared filter: "Metro within 15 min walk" (field is added in lib/enrich.ts).
// 15, not 10: we only know each area's centre, so a tighter limit
// would wrongly leave out places that are actually close to a station.
const nearMetro: ToggleFilter = {
  key: 'nearMetro',
  label: 'Metro within 15 min walk',
  type: 'toggle',
  field: 'metroWalkMins',
  test: (v) => typeof v === 'number' && v <= 15,
  aliases: ['near metro', 'close to metro', 'metro nearby', 'walk to metro', 'metro station nearby'],
}

export const CATEGORIES: Category[] = [
  define<College>({
    id: 'colleges',
    name: 'Colleges',
    group: 'Study',
    blurb: 'Degree and PUC colleges, by course and fees',
    data: colleges as College[],
    similarBy: 'type', // "Similar colleges" = same stream (Engineering, Law ...)
    keywords: [
      'college',
      'colleges',
      'university',
      'universities',
      'degree',
      'puc',
      'pu college',
      'pre-university',
      'engineering',
      'medical',
      'law',
      'mba',
      'bca',
      'bcom',
      'bba',
      'btech',
      'mbbs',
      'agriculture',
      'nirf',
    ],
    visitMins: 60, // default time for a campus visit in the day planner
    filters: [
      {
        key: 'level',
        label: 'Level',
        type: 'multi',
        field: 'level',
        aliases: { PUC: ['puc', 'pu', 'pre-university', '11th', '12th'], Degree: ['degree', 'ug', 'graduation'] },
      },
      {
        key: 'type',
        label: 'Stream',
        type: 'multi',
        field: 'type',
        aliases: { Engineering: ['engineering'], Medical: ['medical'], Law: ['law'], Management: ['management'] },
      },
      {
        key: 'courses',
        label: 'Course',
        type: 'multi',
        field: 'courses',
        aliases: {
          BTech: ['b.tech', 'btech'],
          BE: ['b.e'],
          'BA LLB': ['llb'],
          'Science (PCMB)': ['pcmb', 'biology'],
          'Science (PCMC)': ['pcmc'],
        },
      },
      {
        key: 'ownership',
        label: 'Type',
        type: 'multi',
        field: 'ownership',
        aliases: { Government: ['government', 'govt'] },
      },
      { key: 'area', label: 'Area', type: 'multi', field: 'area' },
      { key: 'rating', label: 'Rating', type: 'minRating', field: 'rating' },
      { key: 'fees', label: 'Max fees per year', type: 'max', field: 'feesPerYear', step: 10000, format: rupees },
      // Only colleges that have an official NIRF 2025 rank
      {
        key: 'nirf',
        label: 'NIRF ranked only',
        type: 'toggle',
        field: 'nirf',
        test: (v) => v !== null,
        aliases: ['nirf', 'ranked'],
      },
      nearMetro,
    ],
    sorts: [
      // nirfSort is a number we made for sorting: exact rank, or the start of
      // the band ("101–150" -> 101). Unranked colleges get 999 so they go last.
      { key: 'nirf', label: 'NIRF rank', field: 'nirfSort', dir: 'asc' },
      { key: 'rating', label: 'Rating', field: 'rating', dir: 'desc' },
      { key: 'fees', label: 'Fees: low to high', field: 'feesPerYear', dir: 'asc' },
    ],
    describe: (c) => ({
      subtitle: `${c.level}, ${c.type}, ${c.area}`,
      facts: [
        ['NIRF 2025', nirfText(c.nirf)],
        ['Fees (approx.)', price(c.feesPerYear, '/yr', 'See college site')],
        ['Ownership', c.ownership],
      ],
      tags: c.courses,
    }),
  }),
  define<School>({
    id: 'schools',
    name: 'Schools',
    group: 'Study',
    blurb: 'CBSE, ICSE, State and IB schools',
    data: schools as School[],
    keywords: ['school', 'schools', 'cbse', 'icse', 'state board', 'ib', 'igcse', 'kindergarten', 'admission'],
    visitMins: 45,
    filters: [
      {
        key: 'board',
        label: 'Board',
        type: 'multi',
        field: 'board',
        aliases: { State: ['state', 'state board', 'karnataka board', 'sslc'], IB: ['ib'] },
      },
      {
        key: 'gender',
        label: 'For',
        type: 'multi',
        field: 'gender',
        aliases: { Boys: ['boys'], Girls: ['girls'], 'Co-ed': ['co-ed', 'coed'] },
      },
      { key: 'area', label: 'Area', type: 'multi', field: 'area' },
      nearMetro,
      { key: 'rating', label: 'Rating', type: 'minRating', field: 'rating' },
      { key: 'fees', label: 'Max fees per year', type: 'max', field: 'feesPerYear', step: 10000, format: rupees },
    ],
    sorts: [
      { key: 'rating', label: 'Rating', field: 'rating', dir: 'desc' },
      { key: 'fees', label: 'Fees: low to high', field: 'feesPerYear', dir: 'asc' },
    ],
    describe: (s) => ({
      subtitle: `${s.board.join(' / ')}, ${s.gender}, ${s.area}`,
      facts: [['Fees (approx.)', price(s.feesPerYear, '/yr', 'See school site')]],
      tags: s.board,
    }),
  }),
  define<Pg>({
    id: 'pgs',
    name: 'PGs and hostels',
    short: 'PGs',
    group: 'Live',
    blurb: 'Paying guests near your college',
    data: pgs as Pg[],
    keywords: [
      'pg',
      'pgs',
      'paying guest',
      'hostel',
      'hostels',
      'co-living',
      'coliving',
      'room',
      'rooms',
      'accommodation',
      'stay',
      'rent room',
    ],
    visitMins: 30,
    filters: [
      {
        key: 'nearCollege',
        label: 'Near college',
        type: 'multi',
        field: 'nearCollege',
        aliases: {
          'Christ University': ['christ'],
          'Jain University': ['jain'],
          'PES University': ['pes'],
          'RV College of Engineering': ['rvce', 'rv college'],
          'Mount Carmel College': ['mount carmel', 'mcc'],
          "St. Joseph's University": ['st joseph', 'st. joseph', 'joseph'],
          'Kristu Jayanti College': ['kristu jayanti', 'kristu'],
          'BMS College of Engineering': ['bms', 'bmsce'],
          'MS Ramaiah Institute of Technology': ['ramaiah', 'msrit'],
          'Dayananda Sagar College of Engineering': ['dayananda sagar', 'dsce'],
          'Presidency University': ['presidency'],
          'REVA University': ['reva'],
          'IIIT Bangalore': ['iiit', 'iiitb'],
          'New Horizon College of Engineering': ['new horizon', 'nhce'],
          'CMR Institute of Technology': ['cmrit', 'cmr'],
        },
      },
      {
        key: 'gender',
        label: 'For',
        type: 'multi',
        field: 'gender',
        aliases: {
          Boys: ['boys', 'gents', 'men'],
          Girls: ['girls', 'ladies', 'women'],
          'Co-living': ['co-living', 'coliving'],
        },
      },
      {
        key: 'sharing',
        label: 'Sharing',
        type: 'multi',
        field: 'sharing',
        aliases: {
          Single: ['single'],
          Double: ['double', 'two sharing'],
          Triple: ['triple', 'three sharing'],
          Quadruple: ['four sharing', 'quadruple'],
        },
      },
      { key: 'area', label: 'Area', type: 'multi', field: 'area' },
      nearMetro,
      {
        key: 'food',
        label: 'Food included',
        type: 'toggle',
        field: 'food',
        aliases: ['with food', 'food included', 'meals'],
      },
      { key: 'rating', label: 'Rating', type: 'minRating', field: 'rating' },
      { key: 'rent', label: 'Max rent per month', type: 'max', field: 'rentPerMonth', step: 500, format: rupees },
    ],
    sorts: [
      { key: 'rent', label: 'Rent: low to high', field: 'rentPerMonth', dir: 'asc' },
      { key: 'rating', label: 'Rating', field: 'rating', dir: 'desc' },
      // commuteMins is worked out in lib/enrich.ts (bus + metro to the college)
      { key: 'commute', label: 'Shortest commute', field: 'commuteMins', dir: 'asc' },
    ],
    describe: (p) => ({
      subtitle: `${p.gender}, ${p.area}, near ${p.nearCollege}`,
      facts: [
        ['Rent from', rupees(p.rentPerMonth) + '/mo'],
        ['Sharing', p.sharing.join(', ')],
        ['Food', p.food ? 'Included' : 'Not included'],
        ['Commute', p.commuteMins != null ? `${p.commuteMins} min by bus or metro` : 'No college set'],
      ],
      tags: p.amenities,
    }),
  }),
  define<Gym>({
    id: 'gyms',
    name: 'Gyms and fitness',
    short: 'Gyms',
    group: 'Live',
    blurb: 'Gyms, cult.fit centres and women-only studios',
    data: gyms as Gym[],
    keywords: ['gym', 'gyms', 'fitness', 'workout', 'yoga', 'zumba', 'boxing', 'cult', 'cult.fit', 'cultfit'],
    visitMins: 60,
    filters: [
      {
        key: 'type',
        label: 'Type',
        type: 'multi',
        field: 'type',
        aliasesOnly: true,
        aliases: {
          'Group classes': ['group class', 'group classes', 'yoga', 'zumba', 'dance', 'boxing', 'hrx', 'cult'],
        },
      },
      { key: 'area', label: 'Area', type: 'multi', field: 'area' },
      nearMetro,
      { key: 'open24x7', label: 'Open 24x7', type: 'toggle', field: 'open24x7', aliases: ['24x7', '24/7', '24 hours'] },
      {
        key: 'womenOnly',
        label: 'Women only',
        type: 'toggle',
        field: 'womenOnly',
        aliases: ['women only', 'womens', "women's", 'ladies', 'for women'],
      },
      { key: 'rating', label: 'Rating', type: 'minRating', field: 'rating' },
      { key: 'fee', label: 'Max fee per month', type: 'max', field: 'monthlyFee', step: 250, format: rupees },
    ],
    sorts: [
      { key: 'rating', label: 'Rating', field: 'rating', dir: 'desc' },
      { key: 'fee', label: 'Fee: low to high', field: 'monthlyFee', dir: 'asc' },
    ],
    describe: (g) => ({
      subtitle: `${g.type}, ${g.area}`,
      facts: [
        ['Fee', price(g.monthlyFee, '/mo', 'Ask at the gym')],
        ['Hours', g.open24x7 ? 'Open 24x7' : (g.hours ?? 'Regular hours')],
      ],
      tags: g.womenOnly ? ['Women only', ...g.amenities] : g.amenities,
    }),
  }),
  define<FoodPlace>({
    id: 'food',
    name: 'Food',
    group: 'Live',
    blurb: 'Darshinis, biryani spots, cafes and pubs',
    data: food as FoodPlace[],
    keywords: [
      'food',
      'eat',
      'eats',
      'restaurant',
      'restaurants',
      'hotel',
      'breakfast',
      'lunch',
      'dinner',
      'dosa',
      'idli',
      'biryani',
      'cafe',
      'coffee',
      'pub',
      'bar',
      'brewery',
      'dessert',
      'ice cream',
      'darshini',
      'bakery',
      'street food',
      'shawarma',
      'seafood',
      'meals',
    ],
    visitMins: 60,
    filters: [
      {
        key: 'cuisine',
        label: 'Cuisine',
        type: 'multi',
        field: 'cuisine',
        aliases: {
          'South Indian': ['dosa', 'idli', 'darshini', 'tiffin', 'south indian', 'breakfast'],
          Desserts: ['dessert', 'ice cream', 'sweet'],
          Pub: ['pub', 'beer', 'brewery', 'bar'],
          Cafe: ['cafe', 'burger', 'coffee'],
          'Street food': ['street food', 'chaat', 'thindi'],
          Bakery: ['bakery', 'puffs'],
          Arabian: ['shawarma', 'arabian'],
          Coastal: ['seafood', 'fish', 'coastal', 'mangalorean'],
        },
      },
      {
        key: 'diet',
        label: 'Diet',
        type: 'multi',
        field: 'diet',
        aliases: { Veg: ['veg', 'vegetarian', 'pure veg'], 'Non-veg': ['non-veg', 'non veg', 'chicken', 'mutton'] },
      },
      { key: 'area', label: 'Area', type: 'multi', field: 'area' },
      nearMetro,
      { key: 'rating', label: 'Rating', type: 'minRating', field: 'rating' },
      { key: 'cost', label: 'Max cost for two', type: 'max', field: 'costForTwo', step: 50, format: rupees },
    ],
    sorts: [
      { key: 'rating', label: 'Rating', field: 'rating', dir: 'desc' },
      { key: 'cost', label: 'Cost: low to high', field: 'costForTwo', dir: 'asc' },
    ],
    describe: (f) => ({
      subtitle: `${f.cuisine}, ${f.diet}, ${f.area}`,
      facts: [
        ['Cost for two (approx.)', rupees(f.costForTwo)],
        ['Known for', f.knownFor],
      ],
      tags: [],
    }),
  }),
  define<Rental>({
    id: 'rentals',
    name: 'Bike and car rentals',
    short: 'Rentals',
    group: 'Move',
    blurb: 'Self-drive bikes, scooters and cars',
    data: rentals as Rental[],
    keywords: [
      'rent',
      'rental',
      'rentals',
      'hire',
      'self drive',
      'self-drive',
      'bike',
      'bikes',
      'scooter',
      'scooty',
      'car rental',
      'electric scooter',
    ],
    visitMins: 20,
    filters: [
      {
        key: 'vehicleType',
        label: 'Vehicle',
        type: 'multi',
        field: 'vehicleType',
        aliases: {
          Bike: ['bike', 'bikes', 'motorcycle'],
          Scooter: ['scooter', 'scooty', 'activa'],
          Car: ['car', 'cars'],
        },
      },
      { key: 'provider', label: 'Provider', type: 'multi', field: 'provider' },
      { key: 'area', label: 'Pickup area', type: 'multi', field: 'area' },
      nearMetro,
      { key: 'rating', label: 'Rating', type: 'minRating', field: 'rating' },
      { key: 'price', label: 'Max price per day', type: 'max', field: 'pricePerDay', step: 100, format: rupees },
    ],
    sorts: [
      { key: 'price', label: 'Price: low to high', field: 'pricePerDay', dir: 'asc' },
      { key: 'rating', label: 'Rating', field: 'rating', dir: 'desc' },
    ],
    describe: (r) => ({
      subtitle: `${r.vehicleType}, ${r.model}, ${r.area}`,
      facts: [
        ['Per day', price(r.pricePerDay)],
        ['Deposit', r.deposit === 0 ? 'None' : price(r.deposit, '', 'Ask them')],
      ],
      tags: [r.provider],
    }),
  }),
  define<Place>({
    id: 'places',
    name: 'Places to visit',
    short: 'Places',
    group: 'See',
    blurb: 'Temples, churches, monuments, parks and museums',
    data: places as Place[],
    keywords: [
      'visit',
      'places',
      'tourist',
      'sightseeing',
      'things to do',
      'temple',
      'temples',
      'church',
      'mosque',
      'masjid',
      'gurudwara',
      'monument',
      'monuments',
      'park',
      'parks',
      'museum',
      'palace',
      'lake',
      'religious',
      'worship',
      'mall',
      'malls',
      'shopping',
      'market',
      'hill',
      'trek',
      'amusement',
      'weekend',
    ],
    visitMins: 60, // places also have their own visitMins in places.json
    filters: [
      {
        key: 'group',
        label: 'Kind of visit',
        type: 'multi',
        field: 'group',
        aliases: {
          Religious: ['religious', 'worship', 'spiritual', 'temple', 'church', 'mosque'],
          Sightseeing: ['non religious', 'non-religious', 'sightseeing', 'tourist'],
        },
      },
      {
        key: 'kind',
        label: 'Place type',
        type: 'multi',
        field: 'kind',
        aliases: {
          Temple: ['temple', 'temples'],
          Church: ['church', 'churches'],
          Mosque: ['mosque', 'masjid'],
          Monument: ['monument', 'monuments', 'heritage'],
          Park: ['park', 'parks', 'garden'],
          Museum: ['museum', 'museums'],
          Mall: ['mall', 'malls'],
          Market: ['market', 'shopping', 'street shopping'],
          Hill: ['hill', 'hills', 'trek', 'sunrise'],
          'Theme park': ['amusement', 'theme park', 'water park'],
        },
      },
      { key: 'area', label: 'Area', type: 'multi', field: 'area' },
      { key: 'free', label: 'Free entry', type: 'toggle', field: 'entryFee', test: (v) => v === 0, aliases: ['free'] },
      nearMetro,
      { key: 'rating', label: 'Rating', type: 'minRating', field: 'rating' },
    ],
    sorts: [
      { key: 'rating', label: 'Rating', field: 'rating', dir: 'desc' },
      { key: 'fee', label: 'Entry fee: low to high', field: 'entryFee', dir: 'asc' },
    ],
    describe: (p) => ({
      subtitle: `${p.kind}, ${p.area}`,
      facts: [
        ['Entry', p.entryFee === 0 ? 'Free' : price(p.entryFee, '', 'Check before going')],
        ['Timings', p.timings],
      ],
      tags: [p.group],
    }),
  }),
  define<Showroom>({
    id: 'showrooms',
    name: 'Vehicle showrooms',
    short: 'Showrooms',
    group: 'See',
    blurb: 'Car, bike and EV showrooms by brand',
    data: showrooms as Showroom[],
    keywords: [
      'showroom',
      'showrooms',
      'dealer',
      'dealership',
      'buy car',
      'new car',
      'buy bike',
      'new bike',
      'test drive',
      'test ride',
    ],
    visitMins: 45,
    filters: [
      {
        key: 'brand',
        label: 'Brand',
        type: 'multi',
        field: 'brand',
        aliases: {
          'Maruti Suzuki': ['maruti', 'suzuki', 'nexa', 'arena'],
          'Mercedes-Benz': ['mercedes', 'benz'],
          'Royal Enfield': ['royal enfield', 'bullet'],
        },
      },
      {
        key: 'segment',
        label: 'Segment',
        type: 'multi',
        field: 'segment',
        aliases: { EV: ['ev', 'electric'], SUV: ['suv'], Luxury: ['luxury'] },
      },
      { key: 'area', label: 'Area', type: 'multi', field: 'area' },
      nearMetro,
      { key: 'rating', label: 'Rating', type: 'minRating', field: 'rating' },
    ],
    sorts: [{ key: 'rating', label: 'Rating', field: 'rating', dir: 'desc' }],
    describe: (s) => ({
      subtitle: `${s.brand}, ${s.area}`,
      facts: [['Services', s.services.join(', ')]],
      tags: s.segment,
    }),
  }),
  define<EventItem>({
    id: 'events',
    name: 'Events',
    group: 'See',
    blurb: 'Runs, walks, fairs and expos coming up',
    data: events as EventItem[],
    keywords: [
      'event',
      'events',
      'happening',
      'marathon',
      'run',
      'runs',
      'walk',
      'walkathon',
      'festival',
      'fair',
      'expo',
      'latest',
      'this weekend',
      'upcoming',
    ],
    visitMins: 180,
    filters: [
      {
        key: 'kind',
        label: 'Kind',
        type: 'multi',
        field: 'kind',
        aliases: {
          Marathon: ['marathon', 'half marathon'],
          Walk: ['walk', 'walking', 'walkathon'],
          Run: ['run', 'running'],
          Festival: ['festival', 'fair'],
        },
      },
      { key: 'distances', label: 'Distance', type: 'multi', field: 'distances' },
    ],
    sorts: [{ key: 'date', label: 'Date', field: 'date', dir: 'asc' }],
    describe: (e) => ({
      subtitle: `${e.kind}, ${e.venue}`,
      facts: [
        [
          'When',
          e.date
            ? prettyDate(e.date) + (e.endDate ? ' to ' + prettyDate(e.endDate) : '')
            : (e.dateLabel ?? 'Date to be announced'),
        ],
        ['By', e.organizer],
      ],
      tags: e.distances,
    }),
  }),
]

// The four groups shown on the home page, in order.
export const GROUPS: { id: Category['group']; title: string }[] = [
  { id: 'Study', title: 'Study' },
  { id: 'Live', title: 'Live and eat' },
  { id: 'Move', title: 'Get around' },
  { id: 'See', title: 'See and do' },
]

// Quick lookup: getCategory('gyms') -> the gyms object above
export function getCategory(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

// Same, but for ids we know exist (throws if not, which means a bug)
export function mustCategory(id: CategoryId): Category {
  const c = getCategory(id)
  if (!c) throw new Error(`Unknown category ${id}`)
  return c
}
