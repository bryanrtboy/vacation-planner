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
  }
];

export const destinations: Destination[] = seededDestinations.map(withFlightLinks);

export function getDestination(slug: string) {
  return destinations.find((destination) => destination.slug === slug);
}
