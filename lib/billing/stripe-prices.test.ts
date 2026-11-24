/**
 * npx tsx --test lib/billing/stripe-prices.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogRefMatches, stripeProductIdOf } from "@/lib/billing/stripe-prices";

describe("Stripe catalog env refs", () => {
  it("matches either a price_ or a prod_ id against the Checkout object", () => {
    assert.equal(
      catalogRefMatches("price_1Uf39o3SDEJLWXWsC8URtCSR", "price_1Uf39o3SDEJLWXWsC8URtCSR", "prod_VgPzzl1uXxb9uQ"),
      true,
    );
    assert.equal(
      catalogRefMatches("prod_VgPzzl1uXxb9uQ", "price_1Uf39o3SDEJLWXWsC8URtCSR", "prod_VgPzzl1uXxb9uQ"),
      true,
    );
    assert.equal(
      catalogRefMatches("prod_VgPzzl1uXxb9uQ", "price_other", "prod_other"),
      false,
    );
    assert.equal(catalogRefMatches(undefined, "price_1", "prod_1"), false);
  });

  it("reads product id from a string or expanded Stripe price", () => {
    assert.equal(stripeProductIdOf({ product: "prod_VgPzzl1uXxb9uQ" }), "prod_VgPzzl1uXxb9uQ");
    assert.equal(stripeProductIdOf({ product: { id: "prod_VgPzzl1uXxb9uQ" } }), "prod_VgPzzl1uXxb9uQ");
    assert.equal(stripeProductIdOf({ product: null }), null);
  });
});
