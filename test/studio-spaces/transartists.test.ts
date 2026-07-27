import assert from "node:assert/strict";
import test from "node:test";
import { parseTransArtistsStudioSpaces } from "../../lib/studio-spaces/transartists.ts";

const fixtureHtml = `
  <h1>Studio Spaces</h1>
  <p>23/7/2026  |</p>
  <h2>Artist Studio in Montreuil</h2>
  <p>A bright 35 m2 artist studio will be available in Montreuil. It is a workspace only and not a living space. Price: 600 eur per month. email: studio [at] example.com</p>
  <p>10/7/2026  |</p>
  <h2>Artists Hideaway by the Sea in Galicia</h2>
  <p>The bright 80 m2 open-plan living space accommodates up to 4 artists and brings together living, working, and resting. Available from August 2026.</p>
  <p>8/7/2026  |</p>
  <h2>a live-in studio space in North Yorkshire</h2>
  <p>I am looking for a live-in studio space in North Yorkshire. My one-bedroom flat in Helsinki is available for a house swap.</p>
  <p>7/7/2026  |</p>
  <h2>Temporary artist stay in Barcelona: Room + Studio</h2>
  <p>The offer includes a room in Poblenou and an independent art studio in El Raval. Price: €1,250 per month.</p>
`;

test("parses and classifies TransArtists studio-space listings", () => {
  const leads = parseTransArtistsStudioSpaces(fixtureHtml, "2026-07-27T00:00:00.000Z");

  assert.equal(leads.length, 4);
  assert.equal(leads.find((lead) => lead.title.includes("Montreuil"))?.kind, "studio-only");
  assert.equal(leads.find((lead) => lead.title.includes("Hideaway"))?.kind, "live-work");
  assert.equal(leads.find((lead) => lead.title.includes("North Yorkshire"))?.kind, "wanted");
  assert.equal(leads.find((lead) => lead.title.includes("Barcelona"))?.kind, "room-plus-studio");
  assert.equal(leads.find((lead) => lead.title.includes("Barcelona"))?.priceText, "Price: €1,250 per month");
});
