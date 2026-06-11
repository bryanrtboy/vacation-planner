import type { Destination } from "@/lib/types";
import { googleFlightsSearchUrl } from "@/lib/flights/links";

const retrievedAt = "2026-06-10";

function withFlightLinks(destination: Destination): Destination {
  const sourceUrl = googleFlightsSearchUrl(destination.flightSearch);
  return {
    ...destination,
    airfare: {
      ...destination.airfare,
      sourceUrl
    },
    links: destination.links.map((link) =>
      link.kind === "airfare" ? { ...link, url: sourceUrl } : link
    )
  };
}

type CandidateInput = {
  slug: string;
  name: string;
  region: string;
  mapQuery: string;
  tripType: string;
  moodLabel: string;
  flightDestination: string;
  destinationAirports: string[];
  departDate: string;
  returnDate: string;
  fitSummary: string;
  caveat: string;
  bestMonths: string;
  avoid: string;
  transport: Destination["transport"];
  transportNote: string;
  monthlyPotential: Destination["monthlyPotential"];
  sharedRentalPotential: Destination["sharedRentalPotential"];
  fit: Destination["fit"];
  airfare: { min: number; max: number; sampledDates: string };
  hotel3Star: { min: number; max: number };
  rental: { min: number; max: number; label: string; sourceUrl: string };
  dining: { min: number; max: number };
  highlights: string[];
  curatedFinds: NonNullable<Destination["curatedFinds"]>;
  links: Destination["links"];
  theme: CandidatePalette;
};

type CandidatePalette = Omit<Destination["visualTheme"], "accentName" | "moodLabel">;

function candidate(input: CandidateInput): Destination {
  return {
    slug: input.slug,
    name: input.name,
    region: input.region,
    mapQuery: input.mapQuery,
    tripType: input.tripType,
    visualTheme: {
      accentName: input.moodLabel,
      ...input.theme,
      moodLabel: input.moodLabel
    },
    flightSearch: {
      origin: "DEN",
      destination: input.flightDestination,
      destinationAirports: input.destinationAirports,
      departDate: input.departDate,
      returnDate: input.returnDate
    },
    fitSummary: input.fitSummary,
    caveat: input.caveat,
    bestMonths: input.bestMonths,
    avoid: input.avoid,
    transport: input.transport,
    transportNote: input.transportNote,
    monthlyPotential: input.monthlyPotential,
    sharedRentalPotential: input.sharedRentalPotential,
    fit: input.fit,
    airfare: {
      min: input.airfare.min,
      max: input.airfare.max,
      currency: "USD",
      label: `$${input.airfare.min.toLocaleString()}-$${input.airfare.max.toLocaleString()} round trip`,
      provider: "Seed airfare estimate",
      sampledDates: input.airfare.sampledDates,
      retrievedAt,
      sourceDetail:
        "Seed airfare estimate retained only as a planning placeholder until live SerpApi flight checks are run.",
      sourceKind: "mock"
    },
    lodging: {
      hotel3Star: {
        min: input.hotel3Star.min,
        max: input.hotel3Star.max,
        currency: "USD",
        label: `$${input.hotel3Star.min}-$${input.hotel3Star.max}/night`,
        provider: "Seed hotel estimate",
        sampledDates: "Shoulder-season planning window",
        retrievedAt,
        sourceDetail:
          "Seed 3-star hotel baseline retained only as a planning placeholder until live lodging checks are run.",
        sourceKind: "mock"
      },
      rental: {
        min: input.rental.min,
        max: input.rental.max,
        currency: "USD",
        label: input.rental.label,
        provider: "Curated lodging search link",
        sampledDates: "Shoulder-season planning window",
        retrievedAt,
        sourceUrl: input.rental.sourceUrl,
        sourceDetail:
          "Curated lodging search link retained as a research path; live lodging prices come from manual SerpApi checks.",
        sourceKind: "mock"
      }
    },
    dining: {
      min: input.dining.min,
      max: input.dining.max,
      currency: "USD",
      label: `$${input.dining.min}-$${input.dining.max}/day for two`,
      provider: "Seed dining estimate",
      sampledDates: "Current city-cost estimate",
      retrievedAt,
      sourceKind: "mock"
    },
    highlights: input.highlights,
    curatedFinds: input.curatedFinds,
    links: [
      { label: "Flight research", url: "https://www.google.com/travel/flights", kind: "airfare" },
      ...input.links
    ]
  };
}

const slate: CandidatePalette = {
  bannerClass: "bg-[linear-gradient(135deg,#12363c_0%,#336b73_52%,#8bb8b4_100%)]",
  photoPosition: "center",
  photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
  heroOverlayClass: "from-[#12363c]/96 via-[#336b73]/74 to-[#336b73]/8",
  cardClass: "border-[#336b73]/75 shadow-[0_10px_30px_rgba(30,70,80,0.16)]",
  panelClass: "bg-[#eef8f7] border-[#abd3d0]",
  summaryClass: "bg-[#eef8f7] border-[#abd3d0]",
  highlightClass: "border-[#12363c] bg-[#336b73] text-white",
  highlightInfoClass: "text-[#336b73]",
  buttonClass: "border-[#336b73] bg-[#336b73] text-white hover:bg-[#12363c]",
  watchActiveClass: "border-[#336b73] bg-[#336b73] text-white hover:bg-[#12363c]",
  textClass: "text-[#336b73]"
};

const moss: CandidatePalette = {
  bannerClass: "bg-[linear-gradient(135deg,#283c18_0%,#5d7738_52%,#c8c76a_100%)]",
  photoPosition: "center",
  photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
  heroOverlayClass: "from-[#283c18]/96 via-[#5d7738]/74 to-[#5d7738]/8",
  cardClass: "border-[#5d7738]/75 shadow-[0_10px_30px_rgba(85,112,48,0.16)]",
  panelClass: "bg-[#f4f8ec] border-[#c8d6a1]",
  summaryClass: "bg-[#f4f8ec] border-[#c8d6a1]",
  highlightClass: "border-[#283c18] bg-[#5d7738] text-white",
  highlightInfoClass: "text-[#5d7738]",
  buttonClass: "border-[#5d7738] bg-[#5d7738] text-white hover:bg-[#283c18]",
  watchActiveClass: "border-[#5d7738] bg-[#5d7738] text-white hover:bg-[#283c18]",
  textClass: "text-[#5d7738]"
};

const clay: CandidatePalette = {
  bannerClass: "bg-[linear-gradient(135deg,#6f2c1e_0%,#b85a38_52%,#dfb06d_100%)]",
  photoPosition: "center",
  photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
  heroOverlayClass: "from-[#6f2c1e]/96 via-[#b85a38]/74 to-[#b85a38]/8",
  cardClass: "border-[#b85a38]/75 shadow-[0_10px_30px_rgba(175,82,46,0.16)]",
  panelClass: "bg-[#fff4ed] border-[#e3b58e]",
  summaryClass: "bg-[#fff4ed] border-[#e3b58e]",
  highlightClass: "border-[#6f2c1e] bg-[#b85a38] text-white",
  highlightInfoClass: "text-[#b85a38]",
  buttonClass: "border-[#b85a38] bg-[#b85a38] text-white hover:bg-[#6f2c1e]",
  watchActiveClass: "border-[#b85a38] bg-[#b85a38] text-white hover:bg-[#6f2c1e]",
  textClass: "text-[#b85a38]"
};

const plum: CandidatePalette = {
  bannerClass: "bg-[linear-gradient(135deg,#33213f_0%,#6d527d_52%,#b69ac4_100%)]",
  photoPosition: "center",
  photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
  heroOverlayClass: "from-[#33213f]/96 via-[#6d527d]/74 to-[#6d527d]/8",
  cardClass: "border-[#6d527d]/75 shadow-[0_10px_30px_rgba(96,70,120,0.16)]",
  panelClass: "bg-[#f6f1f8] border-[#cbb7d4]",
  summaryClass: "bg-[#f6f1f8] border-[#cbb7d4]",
  highlightClass: "border-[#33213f] bg-[#6d527d] text-white",
  highlightInfoClass: "text-[#6d527d]",
  buttonClass: "border-[#6d527d] bg-[#6d527d] text-white hover:bg-[#33213f]",
  watchActiveClass: "border-[#6d527d] bg-[#6d527d] text-white hover:bg-[#33213f]",
  textClass: "text-[#6d527d]"
};

const additionalDestinations: Destination[] = [
  candidate({
    slug: "porto-douro",
    name: "Porto and the Douro",
    region: "Portugal",
    mapQuery: "Porto Douro Portugal",
    tripType: "Tiles, river neighborhoods, food markets, and wine-country train days",
    moodLabel: "river tiles",
    flightDestination: "Porto",
    destinationAirports: ["OPO"],
    departDate: "2026-10-20",
    returnDate: "2026-10-27",
    fitSummary:
      "A compact northern Portugal base with azulejos, contemporary galleries, steep neighborhoods, food markets, and easy Douro day trips.",
    caveat: "Hills and damp weather can slow the pace; the best version is neighborhood-based, not checklist-heavy.",
    bestMonths: "April-June, September-October",
    avoid: "Rainier midwinter weeks",
    transport: "Train-first",
    transportNote: "Use trains and walking in Porto. Add a Douro train day before considering a car.",
    monthlyPotential: "Good",
    sharedRentalPotential: "Good",
    fit: { art: 8, gardens: 6, food: 9, landscape: 8 },
    airfare: { min: 820, max: 1300, sampledDates: "Oct 20-27, Apr 21-28" },
    hotel3Star: { min: 100, max: 175 },
    rental: {
      min: 120,
      max: 245,
      label: "$120-$245/night apartment searches",
      sourceUrl: "https://www.booking.com/searchresults.html?ss=Porto%2C%20Portugal"
    },
    dining: { min: 80, max: 145 },
    highlights: ["Serralves", "azulejo churches", "Bolhao market", "Douro train"],
    curatedFinds: [
      { label: "Serralves", note: "Museum and gardens together, useful for an art/garden day without leaving the city.", kind: "art" },
      { label: "Douro by train", note: "Gives landscape payoff without turning the stay into a driving trip.", kind: "landscape" },
      { label: "Tile walks", note: "Porto is strong for visual wandering: facades, churches, stations, and small streets.", kind: "craft" }
    ],
    links: [
      { label: "Porto apartment search", url: "https://www.booking.com/searchresults.html?ss=Porto%2C%20Portugal", kind: "lodging" },
      { label: "Serralves", url: "https://www.serralves.pt/en/", kind: "art" },
      { label: "Portugal trains", url: "https://www.cp.pt/passageiros/en", kind: "transport" }
    ],
    theme: slate
  }),
  candidate({
    slug: "valencia",
    name: "Valencia",
    region: "Spain",
    mapQuery: "Valencia Spain",
    tripType: "Ceramics, gardens, markets, and beach-edge apartment days",
    moodLabel: "ceramics and gardens",
    flightDestination: "Valencia",
    destinationAirports: ["VLC", "MAD"],
    departDate: "2026-10-13",
    returnDate: "2026-10-20",
    fitSummary:
      "A practical Spain base with ceramics, food markets, parks, architecture, beach access, and less pressure than Barcelona.",
    caveat: "Flights may route better through Madrid; summer can be sticky and crowded near the beach.",
    bestMonths: "March-June, September-November",
    avoid: "August heat and beach crowds",
    transport: "No car needed",
    transportNote: "Metro, tram, bikes, and trains cover the relaxed version well.",
    monthlyPotential: "Excellent",
    sharedRentalPotential: "Good",
    fit: { art: 8, gardens: 8, food: 9, landscape: 7 },
    airfare: { min: 850, max: 1350, sampledDates: "Oct 13-20, Nov 3-10" },
    hotel3Star: { min: 95, max: 170 },
    rental: {
      min: 115,
      max: 235,
      label: "$115-$235/night apartment searches",
      sourceUrl: "https://www.booking.com/searchresults.html?ss=Valencia%2C%20Spain"
    },
    dining: { min: 85, max: 150 },
    highlights: ["ceramics museum", "Turia gardens", "Central Market", "Albufera"],
    curatedFinds: [
      { label: "Ceramics museum", note: "A strong direct match for decorative arts and surface/design looking.", kind: "art" },
      { label: "Turia gardens", note: "A long green route through the city that makes apartment days easier.", kind: "landscape" },
      { label: "Central Market", note: "Food culture is easy to fold into daily routines rather than special meals only.", kind: "food" }
    ],
    links: [
      { label: "Valencia apartment search", url: "https://www.booking.com/searchresults.html?ss=Valencia%2C%20Spain", kind: "lodging" },
      { label: "Ceramics museum", url: "https://www.museunacionalceramica.es/en", kind: "art" },
      { label: "Renfe", url: "https://www.renfe.com/es/en", kind: "transport" }
    ],
    theme: clay
  }),
  candidate({
    slug: "ljubljana-slovenia",
    name: "Ljubljana and Lake Bled",
    region: "Slovenia",
    mapQuery: "Ljubljana Slovenia Lake Bled",
    tripType: "Small capital, design walks, markets, and alpine day trips",
    moodLabel: "small capital green",
    flightDestination: "Ljubljana",
    destinationAirports: ["LJU", "VIE", "ZAG"],
    departDate: "2026-09-15",
    returnDate: "2026-09-22",
    fitSummary:
      "A relaxed small-city base with architecture, markets, riverside walking, and easy access to alpine landscape without a huge urban footprint.",
    caveat: "Air routing can be indirect; a car helps for deeper countryside but is not required for the city stay.",
    bestMonths: "May-June, September-October",
    avoid: "Peak July-August lake crowds",
    transport: "Train-first",
    transportNote: "City is easy on foot. Use trains/buses for Bled; rent a car only for rural loops.",
    monthlyPotential: "Good",
    sharedRentalPotential: "Possible",
    fit: { art: 7, gardens: 7, food: 7, landscape: 10 },
    airfare: { min: 900, max: 1450, sampledDates: "Sep 15-22, Oct 6-13" },
    hotel3Star: { min: 105, max: 180 },
    rental: {
      min: 115,
      max: 225,
      label: "$115-$225/night apartment searches",
      sourceUrl: "https://www.booking.com/searchresults.html?ss=Ljubljana%2C%20Slovenia"
    },
    dining: { min: 80, max: 145 },
    highlights: ["Plečnik architecture", "riverside markets", "Lake Bled", "Metelkova"],
    curatedFinds: [
      { label: "Plečnik walks", note: "A compact architecture thread that gives the city a clear visual identity.", kind: "art" },
      { label: "Lake day", note: "Landscape payoff is easy without making the entire trip outdoorsy.", kind: "day-trip" },
      { label: "Market mornings", note: "Good for slow apartment-based days and casual food exploration.", kind: "food" }
    ],
    links: [
      { label: "Ljubljana apartment search", url: "https://www.booking.com/searchresults.html?ss=Ljubljana%2C%20Slovenia", kind: "lodging" },
      { label: "Slovenian rail", url: "https://potniski.sz.si/en/", kind: "transport" },
      { label: "Ljubljana tourism", url: "https://www.visitljubljana.com/en/visitors/", kind: "guide" }
    ],
    theme: moss
  }),
  candidate({
    slug: "palermo-western-sicily",
    name: "Palermo and Western Sicily",
    region: "Italy",
    mapQuery: "Palermo Sicily Italy",
    tripType: "Markets, mosaics, palazzi, coast, and food-heavy wandering",
    moodLabel: "mosaics and markets",
    flightDestination: "Palermo",
    destinationAirports: ["PMO"],
    departDate: "2026-10-20",
    returnDate: "2026-10-27",
    fitSummary:
      "A vivid, layered city for food, old surfaces, markets, architecture, and coastal day trips with a strong apartment-stay angle.",
    caveat: "It is visually rich but not polished; pick lodging carefully and keep the daily plan loose.",
    bestMonths: "April-June, September-November",
    avoid: "August heat and peak beach season",
    transport: "No car needed",
    transportNote: "Stay central and use trains or drivers for day trips; avoid city driving.",
    monthlyPotential: "Good",
    sharedRentalPotential: "Good",
    fit: { art: 8, gardens: 6, food: 10, landscape: 8 },
    airfare: { min: 950, max: 1500, sampledDates: "Oct 20-27, Nov 3-10" },
    hotel3Star: { min: 85, max: 155 },
    rental: {
      min: 100,
      max: 220,
      label: "$100-$220/night apartment searches",
      sourceUrl: "https://www.booking.com/searchresults.html?ss=Palermo%2C%20Italy"
    },
    dining: { min: 80, max: 150 },
    highlights: ["Palatine Chapel", "markets", "Monreale", "Mondello"],
    curatedFinds: [
      { label: "Monreale mosaics", note: "A high-payoff visual day for color, pattern, and old surface work.", kind: "day-trip" },
      { label: "Market routes", note: "Food and street texture are central rather than add-ons.", kind: "food" },
      { label: "Palazzo days", note: "Architecture and decorative interiors make rainy or hot days workable.", kind: "art" }
    ],
    links: [
      { label: "Palermo apartment search", url: "https://www.booking.com/searchresults.html?ss=Palermo%2C%20Italy", kind: "lodging" },
      { label: "Trenitalia", url: "https://www.trenitalia.com/en.html", kind: "transport" },
      { label: "Visit Sicily", url: "https://www.visitsicily.info/en/", kind: "guide" }
    ],
    theme: clay
  }),
  candidate({
    slug: "oaxaca-city",
    name: "Oaxaca City",
    region: "Mexico",
    mapQuery: "Oaxaca City Mexico",
    tripType: "Textiles, printmaking, markets, food, and courtyard lodging",
    moodLabel: "textiles and courtyards",
    flightDestination: "Oaxaca",
    destinationAirports: ["OAX", "MEX"],
    departDate: "2026-11-10",
    returnDate: "2026-11-17",
    fitSummary:
      "A strong creative stay for textiles, printmaking, food markets, ceramics, courtyard rentals, and day trips to craft villages.",
    caveat: "Popular weeks around major festivals book early; village trips usually need a driver or guide.",
    bestMonths: "January-March, November",
    avoid: "Major festival weeks unless booked intentionally",
    transport: "Driver recommended",
    transportNote: "Walk the city, then use drivers or guides for craft villages and ruins.",
    monthlyPotential: "Excellent",
    sharedRentalPotential: "Excellent",
    fit: { art: 9, gardens: 5, food: 10, landscape: 8 },
    airfare: { min: 520, max: 950, sampledDates: "Nov 10-17, Jan 20-27" },
    hotel3Star: { min: 75, max: 145 },
    rental: {
      min: 95,
      max: 220,
      label: "$95-$220/night courtyard or apartment searches",
      sourceUrl: "https://www.booking.com/searchresults.html?ss=Oaxaca%20City%2C%20Mexico"
    },
    dining: { min: 65, max: 130 },
    highlights: ["textile villages", "print studios", "markets", "Monte Alban"],
    curatedFinds: [
      { label: "Textile villages", note: "Very strong fit for craft-centered travel, especially with a guide or planned workshop day.", kind: "craft" },
      { label: "Print studios", note: "Oaxaca has a live printmaking scene that can turn looking into doing.", kind: "art" },
      { label: "Market food", note: "Food value can be excellent without needing formal restaurant planning.", kind: "food" }
    ],
    links: [
      { label: "Oaxaca lodging search", url: "https://www.booking.com/searchresults.html?ss=Oaxaca%20City%2C%20Mexico", kind: "lodging" },
      { label: "Oaxaca tourism", url: "https://www.oaxaca.travel/en/", kind: "guide" }
    ],
    theme: plum
  }),
  candidate({
    slug: "san-miguel-guanajuato",
    name: "San Miguel de Allende",
    region: "Mexico",
    mapQuery: "San Miguel de Allende Guanajuato Mexico",
    tripType: "Courtyard house base, craft, galleries, food, and colonial walking",
    moodLabel: "courtyards and galleries",
    flightDestination: "Queretaro",
    destinationAirports: ["QRO", "BJX", "MEX"],
    departDate: "2026-11-03",
    returnDate: "2026-11-10",
    fitSummary:
      "An easy creative base with galleries, craft traditions, courtyards, food, and strong house-rental potential for a slower stay.",
    caveat: "It can feel expat-polished; the better version includes nearby towns and craft routes.",
    bestMonths: "January-March, October-November",
    avoid: "Holiday peak weeks if lodging value matters",
    transport: "Driver recommended",
    transportNote: "Walk in town. Use drivers for airport transfers and craft/day-trip loops.",
    monthlyPotential: "Excellent",
    sharedRentalPotential: "Excellent",
    fit: { art: 8, gardens: 6, food: 8, landscape: 7 },
    airfare: { min: 480, max: 850, sampledDates: "Nov 3-10, Feb 3-10" },
    hotel3Star: { min: 85, max: 160 },
    rental: {
      min: 120,
      max: 300,
      label: "$120-$300/night courtyard house searches",
      sourceUrl: "https://www.booking.com/searchresults.html?ss=San%20Miguel%20de%20Allende%2C%20Mexico"
    },
    dining: { min: 75, max: 145 },
    highlights: ["courtyard houses", "Fabrica La Aurora", "craft routes", "Guanajuato day"],
    curatedFinds: [
      { label: "Fabrica La Aurora", note: "Gallery and studio density makes this an easy art anchor.", kind: "art" },
      { label: "House rental angle", note: "One of the better candidates for a group house or longer courtyard stay.", kind: "lodging" },
      { label: "Craft routes", note: "Nearby craft towns add texture beyond the polished center.", kind: "craft" }
    ],
    links: [
      { label: "San Miguel lodging search", url: "https://www.booking.com/searchresults.html?ss=San%20Miguel%20de%20Allende%2C%20Mexico", kind: "lodging" },
      { label: "Fabrica La Aurora", url: "https://fabricalaaurora.com/", kind: "art" }
    ],
    theme: clay
  }),
  candidate({
    slug: "santa-fe-taos",
    name: "Santa Fe and Taos",
    region: "United States",
    mapQuery: "Santa Fe Taos New Mexico",
    tripType: "Adobe, museums, landscape, food, and house-rental days",
    moodLabel: "adobe and high desert",
    flightDestination: "Santa Fe",
    destinationAirports: ["SAF", "ABQ"],
    departDate: "2026-10-06",
    returnDate: "2026-10-13",
    fitSummary:
      "A domestic option with museums, adobe architecture, food, galleries, high-desert landscape, and strong rental-house potential.",
    caveat: "A car is part of the good version, especially for Taos, Chimayo, and landscape days.",
    bestMonths: "May-June, September-October",
    avoid: "High winter unless snow and fireplaces are the point",
    transport: "Car useful",
    transportNote: "Use a car for Taos, Chimayo, and trail/landscape days; park it for central Santa Fe walking.",
    monthlyPotential: "Good",
    sharedRentalPotential: "Excellent",
    fit: { art: 10, gardens: 5, food: 8, landscape: 10 },
    airfare: { min: 180, max: 520, sampledDates: "Oct 6-13, May 12-19" },
    hotel3Star: { min: 150, max: 260 },
    rental: {
      min: 180,
      max: 420,
      label: "$180-$420/night casita or house searches",
      sourceUrl: "https://www.booking.com/searchresults.html?ss=Santa%20Fe%2C%20New%20Mexico"
    },
    dining: { min: 95, max: 175 },
    highlights: ["Georgia O'Keeffe Museum", "Museum Hill", "Taos", "high desert"],
    curatedFinds: [
      { label: "Museum Hill", note: "A concentrated art/culture anchor that makes short stays efficient.", kind: "art" },
      { label: "House rental days", note: "Good candidate for a splurge stay if rental prices break well.", kind: "lodging" },
      { label: "Taos loop", note: "Landscape and craft texture are stronger when paired with a car day north.", kind: "day-trip" }
    ],
    links: [
      { label: "Santa Fe lodging search", url: "https://www.booking.com/searchresults.html?ss=Santa%20Fe%2C%20New%20Mexico", kind: "lodging" },
      { label: "O'Keeffe Museum", url: "https://www.okeeffemuseum.org/", kind: "art" }
    ],
    theme: moss
  }),
  candidate({
    slug: "victoria-vancouver-island",
    name: "Victoria and Vancouver Island",
    region: "Canada",
    mapQuery: "Victoria Vancouver Island British Columbia",
    tripType: "Gardens, coast, food, and quiet apartment or cottage days",
    moodLabel: "gardens and coast",
    flightDestination: "Victoria",
    destinationAirports: ["YYJ", "YVR", "SEA"],
    departDate: "2026-09-15",
    returnDate: "2026-09-22",
    fitSummary:
      "A quieter coastal option for gardens, food, walking, ferries, and rental stays without chasing a dense museum itinerary.",
    caveat: "Ferries and island distances can eat time; keep the base simple.",
    bestMonths: "May-June, September",
    avoid: "Wettest winter weeks",
    transport: "Car useful",
    transportNote: "Victoria can be walked, but a car helps for gardens, beaches, and island edges.",
    monthlyPotential: "Selective",
    sharedRentalPotential: "Good",
    fit: { art: 6, gardens: 10, food: 8, landscape: 9 },
    airfare: { min: 420, max: 850, sampledDates: "Sep 15-22, May 19-26" },
    hotel3Star: { min: 155, max: 260 },
    rental: {
      min: 170,
      max: 360,
      label: "$170-$360/night apartment or cottage searches",
      sourceUrl: "https://www.booking.com/searchresults.html?ss=Victoria%2C%20British%20Columbia%2C%20Canada"
    },
    dining: { min: 105, max: 190 },
    highlights: ["Butchart Gardens", "coastal walks", "ferries", "food markets"],
    curatedFinds: [
      { label: "Butchart Gardens", note: "The obvious garden anchor, but still high-value if timed outside peak crowd hours.", kind: "landscape" },
      { label: "Cottage angle", note: "Worth watching lodging prices because a cottage can change the whole value of the trip.", kind: "lodging" },
      { label: "Coastal walking", note: "A better fit for slow days than a museum-heavy itinerary.", kind: "landscape" }
    ],
    links: [
      { label: "Victoria lodging search", url: "https://www.booking.com/searchresults.html?ss=Victoria%2C%20British%20Columbia%2C%20Canada", kind: "lodging" },
      { label: "BC Ferries", url: "https://www.bcferries.com/", kind: "transport" },
      { label: "Butchart Gardens", url: "https://www.butchartgardens.com/", kind: "guide" }
    ],
    theme: slate
  })
];

const seededDestinations: Destination[] = [
  {
    slug: "lisbon-coast",
    name: "Lisbon Coast",
    region: "Portugal",
    mapQuery: "Lisbon Coast Cascais Portugal",
    tripType: "Coastal apartment base with train day trips",
    visualTheme: {
      accentName: "terracotta",
      bannerClass: "bg-[linear-gradient(135deg,#a9482e_0%,#d9793d_48%,#f2b36f_100%)]",
      photoUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/33037-Cascais_%2835538412783%29.jpg/250px-33037-Cascais_%2835538412783%29.jpg",
      photoPosition: "center",
      photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
      heroOverlayClass: "from-[#7a210e]/95 via-[#b5431f]/72 to-[#b5431f]/8",
      cardClass: "border-[#c9552d]/75 shadow-[0_10px_30px_rgba(201,85,45,0.16)]",
      panelClass: "bg-[#fff4ea] border-[#e7b282]",
      summaryClass: "bg-[#fff4ec] border-[#e7b282]",
      highlightClass: "border-[#a33a1b] bg-[#b5431f] text-white",
      highlightInfoClass: "text-[#b5431f]",
      buttonClass: "border-[#c96738] bg-[#c96738] text-white hover:bg-[#8d3e29]",
      watchActiveClass: "border-[#b5431f] bg-[#b5431f] text-white hover:bg-[#8d3e29]",
      textClass: "text-[#8d3e29]",
      moodLabel: "coastal tiles"
    },
    flightSearch: {
      origin: "DEN",
      destination: "Lisbon",
      destinationAirports: ["LIS"],
      departDate: "2027-04-14",
      returnDate: "2027-04-21"
    },
    fitSummary:
      "A strong first pass for ceramics, tiles, contemporary galleries, gardens, ocean light, and train-friendly wandering without feeling like a checklist trip.",
    caveat:
      "Sintra and central Lisbon can be crowded; the better version is a quiet base in Cascais, Estoril, or west of Lisbon.",
    bestMonths: "March-May, late September-November",
    avoid: "August crowds and hotter inland day trips",
    transport: "Train-first",
    transportNote:
      "Use trains for Lisbon/Cascais/Sintra. Rent a car only for western beaches or countryside days.",
    monthlyPotential: "Excellent",
    sharedRentalPotential: "Good",
    fit: { art: 9, gardens: 8, food: 8, landscape: 8 },
    airfare: {
      min: 800,
      max: 1000,
      currency: "USD",
      label: "$800-$1,000 round trip",
      provider: "Google Flights search-link baseline",
      sampledDates: "Apr 14-21, Apr 21-28, May 5-12",
      retrievedAt,
      sourceDetail:
        "Fallback airfare range calibrated from the linked Google Flights search when live API snapshots are unavailable.",
      sourceKind: "cached"
    },
    lodging: {
      hotel3Star: {
        min: 110,
        max: 185,
        currency: "USD",
        label: "$110-$185/night",
        provider: "Mock hotel baseline",
        sampledDates: "April weekday samples",
        retrievedAt,
        sourceDetail:
          "Mock 3-star baseline for spring coastal Portugal. Hotels are retained only as a reference point against apartments.",
        sourceKind: "mock"
      },
      rental: {
        min: 145,
        max: 290,
        currency: "USD",
        label: "$145-$290/night apartment searches",
        provider: "Curated rental search link",
        sampledDates: "Spring search window",
        retrievedAt,
        sourceUrl: "https://www.booking.com/searchresults.html?ss=Cascais%2C%20Portugal",
        sourceDetail:
          "Rental search focuses on Cascais and Lisbon-coast apartment-style stays, not a direct Airbnb/Vrbo scrape.",
        sourceKind: "mock"
      }
    },
    dining: {
      min: 85,
      max: 145,
      currency: "USD",
      label: "$85-$145/day for two",
      provider: "Mock dining estimate",
      sampledDates: "Current city-cost estimate",
      retrievedAt,
      sourceKind: "mock"
    },
    highlights: ["Museu Calouste Gulbenkian", "MAAT", "tile traditions", "Sintra gardens"],
    curatedFinds: [
      {
        label: "Tile and print workshops",
        note: "Better fit than formal residencies: small ceramics, tile, and printmaking sessions can turn this from sightseeing into a working creative stay.",
        kind: "retreat"
      },
      {
        label: "Gulbenkian",
        note: "A compact museum anchor with strong gardens, design objects, and modern collections without needing an all-day museum commitment.",
        url: "https://gulbenkian.pt/museu/en/",
        kind: "art"
      },
      {
        label: "Cascais base",
        note: "Keeps Lisbon available by train while making the stay quieter, coastal, and less checklist-driven.",
        kind: "lodging"
      }
    ],
    retreatNote: "Look for small tile, printmaking, and ceramics workshops rather than formal residencies.",
    links: [
      { label: "Flight research", url: "https://www.google.com/travel/flights", kind: "airfare" },
      { label: "Cascais apartment search", url: "https://www.booking.com/searchresults.html?ss=Cascais%2C%20Portugal", kind: "lodging" },
      { label: "Gulbenkian Museum", url: "https://gulbenkian.pt/museu/en/", kind: "art" },
      { label: "Portugal trains", url: "https://www.cp.pt/passageiros/en", kind: "transport" }
    ]
  },
  {
    slug: "bologna-emilia",
    name: "Bologna and Emilia-Romagna",
    region: "Italy",
    mapQuery: "Bologna Emilia-Romagna Italy",
    tripType: "Food, porticoes, trains, small museum days",
    visualTheme: {
      accentName: "emilia blue",
      bannerClass: "bg-[linear-gradient(135deg,#163b63_0%,#2f6f9f_50%,#84b7d5_100%)]",
      photoUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Portici-1.jpg/330px-Portici-1.jpg",
      photoPosition: "center",
      photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
      heroOverlayClass: "from-[#061f46]/96 via-[#174f86]/76 to-[#174f86]/8",
      cardClass: "border-[#1d5f93]/75 shadow-[0_10px_30px_rgba(29,95,147,0.17)]",
      panelClass: "bg-[#eef7fb] border-[#a7cfe2]",
      summaryClass: "bg-[#edf7fc] border-[#a9cfe5]",
      highlightClass: "border-[#0f4571] bg-[#174f86] text-white",
      highlightInfoClass: "text-[#174f86]",
      buttonClass: "border-[#255f8a] bg-[#255f8a] text-white hover:bg-[#173d5f]",
      watchActiveClass: "border-[#174f86] bg-[#174f86] text-white hover:bg-[#0f3f6a]",
      textClass: "text-[#255f8a]",
      moodLabel: "porticoes and trains"
    },
    flightSearch: {
      origin: "DEN",
      destination: "Bologna",
      destinationAirports: ["BLQ"],
      departDate: "2026-10-08",
      returnDate: "2026-10-15"
    },
    fitSummary:
      "A slower, more useful Italy base than the obvious circuit: dense food culture, architecture, university energy, and easy train access to smaller cities.",
    caveat:
      "Not a landscape-first stay unless paired with countryside days; summer can feel heavy and hot.",
    bestMonths: "April-June, September-November",
    avoid: "July-August heat and peak fair dates",
    transport: "Train-first",
    transportNote:
      "Excellent train base. Avoid driving into historic centers; use a car only for rural food or ceramics days.",
    monthlyPotential: "Good",
    sharedRentalPotential: "Good",
    fit: { art: 8, gardens: 5, food: 10, landscape: 6 },
    airfare: {
      min: 1000,
      max: 1400,
      currency: "USD",
      label: "$1,000-$1,400 round trip",
      provider: "Google Flights search-link baseline",
      sampledDates: "Oct 8-15, Oct 15-22, Nov 5-12",
      retrievedAt,
      sourceDetail:
        "Fallback airfare range calibrated from the linked Google Flights search when live API snapshots are unavailable.",
      sourceKind: "cached"
    },
    lodging: {
      hotel3Star: {
        min: 105,
        max: 180,
        currency: "USD",
        label: "$105-$180/night",
        provider: "Mock hotel baseline",
        sampledDates: "October weekday samples",
        retrievedAt,
        sourceDetail:
          "Mock 3-star baseline for central Bologna. Used as a pricing anchor, not as a hotel-shopping grid.",
        sourceKind: "mock"
      },
      hotel4StarDeal: {
        min: 145,
        max: 215,
        currency: "USD",
        label: "$145-$215/night when deals appear",
        provider: "Mock hotel baseline",
        sampledDates: "October weekday samples",
        retrievedAt,
        sourceDetail:
          "Mock 4-star deal note for occasional central Bologna dips during fall samples.",
        sourceKind: "mock"
      },
      rental: {
        min: 135,
        max: 260,
        currency: "USD",
        label: "$135-$260/night apartment searches",
        provider: "Curated rental search link",
        sampledDates: "Fall search window",
        retrievedAt,
        sourceUrl: "https://www.booking.com/searchresults.html?ss=Bologna%2C%20Italy",
        sourceDetail:
          "Rental search points at Bologna apartment stays with trains to Modena, Parma, Ravenna, and nearby food cities.",
        sourceKind: "mock"
      }
    },
    dining: {
      min: 95,
      max: 170,
      currency: "USD",
      label: "$95-$170/day for two",
      provider: "Mock dining estimate",
      sampledDates: "Current city-cost estimate",
      retrievedAt,
      sourceKind: "mock"
    },
    highlights: ["MAMbo", "porticoes", "Modena day trip", "Ravenna mosaics by train"],
    curatedFinds: [
      {
        label: "MAMbo",
        note: "Bologna's modern art museum gives the city a clear contemporary anchor beyond food and architecture.",
        url: "https://www.mambo-bologna.org/en/",
        kind: "art"
      },
      {
        label: "Ravenna mosaics",
        note: "A strong day trip for color, pattern, and old surfaces; useful if the trip needs more visual payoff than food alone.",
        kind: "day-trip"
      },
      {
        label: "Portico walking days",
        note: "The covered arcades make slower wandering practical even when the weather is imperfect.",
        kind: "landscape"
      }
    ],
    links: [
      { label: "Flight research", url: "https://www.google.com/travel/flights", kind: "airfare" },
      { label: "Bologna apartment search", url: "https://www.booking.com/searchresults.html?ss=Bologna%2C%20Italy", kind: "lodging" },
      { label: "MAMbo", url: "https://www.mambo-bologna.org/en/", kind: "art" },
      { label: "Trenitalia", url: "https://www.trenitalia.com/en.html", kind: "transport" }
    ]
  },
  {
    slug: "essaouira",
    name: "Essaouira",
    region: "Morocco",
    mapQuery: "Essaouira Morocco",
    tripType: "Coastal riad, craft, food, and day-driver base",
    visualTheme: {
      accentName: "sea ochre",
      bannerClass: "bg-[linear-gradient(135deg,#0f6f73_0%,#2a9aa0_48%,#d8a24a_100%)]",
      photoUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b6/Morocco_-_Essaouira_Part_2_%2831679848385%29.jpg/330px-Morocco_-_Essaouira_Part_2_%2831679848385%29.jpg",
      photoPosition: "center",
      photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
      heroOverlayClass: "from-[#00494f]/96 via-[#087b84]/74 to-[#087b84]/8",
      cardClass: "border-[#087b84]/75 shadow-[0_10px_30px_rgba(8,123,132,0.17)]",
      panelClass: "bg-[#edf8f7] border-[#9ccfca]",
      summaryClass: "bg-[#eefbf9] border-[#9ccfca]",
      highlightClass: "border-[#00646b] bg-[#087b84] text-white",
      highlightInfoClass: "text-[#087b84]",
      buttonClass: "border-[#0f6f73] bg-[#0f6f73] text-white hover:bg-[#0a4d50]",
      watchActiveClass: "border-[#087b84] bg-[#087b84] text-white hover:bg-[#00646b]",
      textClass: "text-[#0f6f73]",
      moodLabel: "riad and Atlantic light"
    },
    flightSearch: {
      origin: "DEN",
      destination: "Essaouira",
      destinationAirports: ["RAK", "ESU"],
      departDate: "2026-11-03",
      returnDate: "2026-11-10"
    },
    fitSummary:
      "A textured creative base with sea air, craft traditions, galleries, food markets, and unusual courtyard lodging without the intensity of Marrakech.",
    caveat:
      "Flights usually require connections and remote day trips are better with a driver.",
    bestMonths: "March-May, October-November",
    avoid: "Windier high summer if beach comfort matters",
    transport: "Driver recommended",
    transportNote:
      "Use drivers for Marrakech transfer or countryside days. Self-driving is possible but not the most relaxed version.",
    monthlyPotential: "Good",
    sharedRentalPotential: "Excellent",
    fit: { art: 7, gardens: 5, food: 8, landscape: 9 },
    airfare: {
      min: 980,
      max: 1580,
      currency: "USD",
      label: "$980-$1,580 round trip",
      provider: "Mock flight sampler",
      sampledDates: "Nov 3-10, Nov 10-17, Mar 10-17",
      retrievedAt,
      sourceDetail:
        "Mock airfare range using Marrakech/Essaouira routing assumptions from DEN. Google Flights link opens a route/date research query.",
      sourceKind: "mock"
    },
    lodging: {
      hotel3Star: {
        min: 70,
        max: 135,
        currency: "USD",
        label: "$70-$135/night",
        provider: "Mock hotel baseline",
        sampledDates: "November weekday samples",
        retrievedAt,
        sourceDetail:
          "Mock 3-star baseline for Essaouira. Useful only as a reference against riads and courtyard rentals.",
        sourceKind: "mock"
      },
      rental: {
        min: 95,
        max: 240,
        currency: "USD",
        label: "$95-$240/night riad or apartment searches",
        provider: "Curated rental search link",
        sampledDates: "Fall search window",
        retrievedAt,
        sourceUrl: "https://www.booking.com/searchresults.html?ss=Essaouira%2C%20Morocco",
        sourceDetail:
          "Rental search focuses on riads, courtyard apartments, and longer creative stays; no direct Airbnb/Vrbo scrape.",
        sourceKind: "mock"
      }
    },
    dining: {
      min: 60,
      max: 120,
      currency: "USD",
      label: "$60-$120/day for two",
      provider: "Mock dining estimate",
      sampledDates: "Current city-cost estimate",
      retrievedAt,
      sourceKind: "mock"
    },
    highlights: ["medina craft streets", "contemporary galleries", "Atlantic light", "courtyard houses"],
    curatedFinds: [
      {
        label: "Riad workshop base",
        note: "Small creative retreats and riad-based workshops are more likely here than institutional residencies.",
        kind: "retreat"
      },
      {
        label: "Medina craft streets",
        note: "Good fit for hands-on looking: woodwork, textiles, metalwork, and market texture are part of the daily route.",
        kind: "craft"
      },
      {
        label: "Atlantic light",
        note: "The coast gives this option a landscape and studio-light quality that Marrakech does not solve as quietly.",
        kind: "landscape"
      }
    ],
    retreatNote: "Small creative retreats and riad-based workshops are more likely than institutional residencies.",
    links: [
      { label: "Flight research", url: "https://www.google.com/travel/flights", kind: "airfare" },
      { label: "Essaouira riad search", url: "https://www.booking.com/searchresults.html?ss=Essaouira%2C%20Morocco", kind: "lodging" },
      { label: "Regional guide", url: "https://www.visitmorocco.com/en/travel/essaouira", kind: "guide" }
    ]
  },
  {
    slug: "graz-styria",
    name: "Graz and Styria",
    region: "Austria",
    mapQuery: "Graz Styria Austria",
    tripType: "Design city with gardens, wine country, and easy trains",
    visualTheme: {
      accentName: "alpine green",
      bannerClass: "bg-[linear-gradient(135deg,#315b3d_0%,#6f8d4e_52%,#d3b95d_100%)]",
      photoUrl: "https://www.wideworldtrips.com/wp-content/uploads/2023/04/hauptplatz-graz.jpg",
      photoPosition: "center",
      photoOverlay: "linear-gradient(rgba(0,0,0,0),rgba(0,0,0,0))",
      heroOverlayClass: "from-[#233d12]/96 via-[#557a2c]/74 to-[#557a2c]/8",
      cardClass: "border-[#557a2c]/75 shadow-[0_10px_30px_rgba(85,122,44,0.17)]",
      panelClass: "bg-[#f3f7ec] border-[#c4d2a0]",
      summaryClass: "bg-[#f5faec] border-[#c4d2a0]",
      highlightClass: "border-[#3f641d] bg-[#557a2c] text-white",
      highlightInfoClass: "text-[#557a2c]",
      buttonClass: "border-[#496d37] bg-[#496d37] text-white hover:bg-[#304b27]",
      watchActiveClass: "border-[#557a2c] bg-[#557a2c] text-white hover:bg-[#3f641d]",
      textClass: "text-[#496d37]",
      moodLabel: "design city and wine roads"
    },
    flightSearch: {
      origin: "DEN",
      destination: "Graz",
      destinationAirports: ["GRZ", "VIE"],
      departDate: "2026-09-09",
      returnDate: "2026-09-16"
    },
    fitSummary:
      "A less obvious Austria base with architecture, contemporary design, food markets, and access to green landscapes without Vienna-scale intensity.",
    caveat:
      "Airfare may be simpler into Vienna or Munich, then train onward.",
    bestMonths: "May-June, September-October",
    avoid: "Midwinter unless the goal is museums and quiet",
    transport: "Train-first",
    transportNote:
      "Trains work well for city links. A car is useful only for wine roads and rural garden days.",
    monthlyPotential: "Selective",
    sharedRentalPotential: "Possible",
    fit: { art: 8, gardens: 7, food: 8, landscape: 8 },
    airfare: {
      min: 850,
      max: 1450,
      currency: "USD",
      label: "$850-$1,450 round trip",
      provider: "Mock flight sampler",
      sampledDates: "Sep 9-16, Sep 16-23, Oct 7-14",
      retrievedAt,
      sourceDetail:
        "Mock airfare range using Graz/Vienna access from DEN. Google Flights link opens a best-effort route/date query.",
      sourceKind: "mock"
    },
    lodging: {
      hotel3Star: {
        min: 95,
        max: 165,
        currency: "USD",
        label: "$95-$165/night",
        provider: "Mock hotel baseline",
        sampledDates: "September weekday samples",
        retrievedAt,
        sourceDetail:
          "Mock 3-star baseline for Graz. Used as an anchor beside apartment searches and longer-stay potential.",
        sourceKind: "mock"
      },
      rental: {
        min: 120,
        max: 235,
        currency: "USD",
        label: "$120-$235/night apartment searches",
        provider: "Curated rental search link",
        sampledDates: "Early fall search window",
        retrievedAt,
        sourceUrl: "https://www.booking.com/searchresults.html?ss=Graz%2C%20Austria",
        sourceDetail:
          "Rental search points at Graz apartment stays, with train-first access and optional rural car days.",
        sourceKind: "mock"
      }
    },
    dining: {
      min: 95,
      max: 165,
      currency: "USD",
      label: "$95-$165/day for two",
      provider: "Mock dining estimate",
      sampledDates: "Current city-cost estimate",
      retrievedAt,
      sourceKind: "mock"
    },
    highlights: ["Kunsthaus Graz", "Schloss Eggenberg", "farm markets", "Styria wine roads"],
    curatedFinds: [
      {
        label: "Kunsthaus Graz",
        note: "A contemporary architecture and art anchor that makes Graz feel less like a generic pretty-city option.",
        url: "https://www.museum-joanneum.at/en/kunsthaus-graz",
        kind: "art"
      },
      {
        label: "Styria wine roads",
        note: "A useful car-day exception: rural food, landscape, and design texture without making the whole trip car-dependent.",
        kind: "landscape"
      },
      {
        label: "Farm markets",
        note: "A quieter food angle than destination restaurants, and a better fit for apartment stays.",
        kind: "food"
      }
    ],
    links: [
      { label: "Flight research", url: "https://www.google.com/travel/flights", kind: "airfare" },
      { label: "Graz apartment search", url: "https://www.booking.com/searchresults.html?ss=Graz%2C%20Austria", kind: "lodging" },
      { label: "Kunsthaus Graz", url: "https://www.museum-joanneum.at/en/kunsthaus-graz", kind: "art" },
      { label: "OeBB trains", url: "https://www.oebb.at/en/", kind: "transport" }
    ]
  },
  ...additionalDestinations
];

export const destinations: Destination[] = seededDestinations.map(withFlightLinks);

export function getDestination(slug: string) {
  return destinations.find((destination) => destination.slug === slug);
}
