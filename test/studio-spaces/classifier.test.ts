import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyStudioKind,
  studioLeadIsUseful,
  studioLeadLooksLikeRealEstateNoise
} from "../../lib/studio-spaces/shared.ts";

test("rejects generic studio apartments from real-estate sources", () => {
  const text = "Studio apartment for rent in Montreal. Furnished monthly rentals on Apartments.com.";
  const kind = classifyStudioKind(text);

  assert.equal(kind, "studio-only");
  assert.equal(studioLeadLooksLikeRealEstateNoise(text), true);
  assert.equal(studioLeadIsUseful(kind, text), false);
});

test("keeps artist workspace rentals even when accommodation is mentioned", () => {
  const text =
    "Montreal artist studio space rental available for one month. Workspace includes easels and shared kitchen; room nearby can be discussed.";
  const kind = classifyStudioKind(text);

  assert.equal(kind, "studio-only");
  assert.equal(studioLeadLooksLikeRealEstateNoise(text), false);
  assert.equal(studioLeadIsUseful(kind, text), true);
});
