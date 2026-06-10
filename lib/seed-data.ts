import type { Destination } from "@/lib/types";

const retrievedAt = "2026-06-10";

function googleFlightsSearchUrl(search: Destination["flightSearch"]) {
  const query = `${search.origin} to ${search.destination} ${search.departDate} ${search.returnDate} round trip`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

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
      photoOverlay: "linear-gradient(135deg,rgba(113,51,31,0.78),rgba(217,121,61,0.42))",
      panelClass: "bg-[#fff4ea] border-[#e7b282]",
      buttonClass: "border-[#c96738] bg-[#c96738] text-white hover:bg-[#8d3e29]",
      textClass: "text-[#8d3e29]",
      moodLabel: "coastal tiles"
    },
    flightSearch: {
      origin: "DEN",
      destination: "Lisbon",
      destinationAirports: ["LIS"],
      departDate: "2026-04-15",
      returnDate: "2026-04-22"
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
      min: 780,
      max: 1250,
      currency: "USD",
      label: "$780-$1,250 round trip",
      provider: "Mock flight sampler",
      sampledDates: "Apr 15-22, Apr 22-29, May 6-13",
      retrievedAt,
      sourceDetail:
        "Mock airfare range based on sampled spring DEN-LIS research windows. Google Flights link opens a best-effort research query with route and dates.",
      sourceKind: "mock"
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
      photoOverlay: "linear-gradient(135deg,rgba(22,59,99,0.82),rgba(47,111,159,0.38))",
      panelClass: "bg-[#eef7fb] border-[#a7cfe2]",
      buttonClass: "border-[#255f8a] bg-[#255f8a] text-white hover:bg-[#173d5f]",
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
      min: 820,
      max: 1380,
      currency: "USD",
      label: "$820-$1,380 round trip",
      provider: "Mock flight sampler",
      sampledDates: "Oct 8-15, Oct 15-22, Nov 5-12",
      retrievedAt,
      sourceDetail:
        "Mock airfare range based on fall DEN-BLQ research windows. Google Flights link opens a best-effort query with route and dates.",
      sourceKind: "mock"
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
      photoOverlay: "linear-gradient(135deg,rgba(15,111,115,0.8),rgba(216,162,74,0.34))",
      panelClass: "bg-[#edf8f7] border-[#9ccfca]",
      buttonClass: "border-[#0f6f73] bg-[#0f6f73] text-white hover:bg-[#0a4d50]",
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
      photoOverlay: "linear-gradient(135deg,rgba(49,91,61,0.82),rgba(211,185,93,0.36))",
      panelClass: "bg-[#f3f7ec] border-[#c4d2a0]",
      buttonClass: "border-[#496d37] bg-[#496d37] text-white hover:bg-[#304b27]",
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
  }
];

export const destinations: Destination[] = seededDestinations.map(withFlightLinks);

export function getDestination(slug: string) {
  return destinations.find((destination) => destination.slug === slug);
}
