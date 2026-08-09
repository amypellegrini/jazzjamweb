import { test, expect } from "@playwright/test";
import shared from "../src/_data/shared.json";

// CJS module under test — the same require style the check-shared-content
// gate's spec uses for scripts/.
const { groupProBenefits } = require("../scripts/pro-benefit-groups");

type Group = { id: string; subtitle: string; catchAll?: boolean };
type Benefit = { id: string; glyph: string; name: string; description: string };

// Stand-in ids and groups rather than the shipped ones: a rule that only ever
// sees "export-"/"all-keys-cycle" could be a hardcoded card list and still pass.
const benefit = (id: string): Benefit => ({
  id,
  glyph: id.slice(0, 3).toUpperCase(),
  name: `name-${id}`,
  description: `description-${id}`,
});

const names = (groups: Array<{ benefits: Benefit[] }>) =>
  groups.map((group) => group.benefits.map((b) => b.id));

test.describe("groupProBenefits", () => {
  test("claims a benefit for the group its id namespaces", () => {
    const groups: Group[] = [
      { id: "alpha", subtitle: "Alpha things" },
      { id: "beta", subtitle: "Beta things" },
    ];
    const benefits = [benefit("beta-two"), benefit("alpha-one"), benefit("beta-one")];

    const grouped = groupProBenefits({ groups, benefits });

    // Group order follows the declaration; benefit order follows the data.
    expect(grouped.map((g: Group) => g.id)).toEqual(["alpha", "beta"]);
    expect(names(grouped)).toEqual([["alpha-one"], ["beta-two", "beta-one"]]);
  });

  test("routes a benefit no namespace claims to the catchAll group", () => {
    const groups: Group[] = [
      { id: "alpha", subtitle: "Alpha things", catchAll: true },
      { id: "beta", subtitle: "Beta things" },
    ];
    const benefits = [benefit("unnamespaced"), benefit("beta-one")];

    expect(names(groupProBenefits({ groups, benefits }))).toEqual([
      ["unnamespaced"],
      ["beta-one"],
    ]);
  });

  test("throws when a benefit maps to no declared group", () => {
    const groups: Group[] = [{ id: "beta", subtitle: "Beta things" }];
    const benefits = [benefit("beta-one"), benefit("unnamespaced")];

    expect(() => groupProBenefits({ groups, benefits })).toThrow(
      /"unnamespaced" maps to no declared group/
    );
  });

  test("throws when two group namespaces claim the same benefit", () => {
    const groups: Group[] = [
      { id: "beta", subtitle: "Beta things" },
      { id: "beta-extra", subtitle: "Beta extras" },
    ];
    const benefits = [benefit("beta-extra-one")];

    expect(() => groupProBenefits({ groups, benefits })).toThrow(
      /maps to more than one group/
    );
  });

  test("throws when more than one group is flagged catchAll", () => {
    const groups: Group[] = [
      { id: "alpha", subtitle: "Alpha things", catchAll: true },
      { id: "beta", subtitle: "Beta things", catchAll: true },
    ];

    expect(() =>
      groupProBenefits({ groups, benefits: [benefit("unnamespaced")] })
    ).toThrow(/more than one group as catchAll/);
  });

  test("throws when a declared group would render with no cards under it", () => {
    const groups: Group[] = [
      { id: "alpha", subtitle: "Alpha things", catchAll: true },
      { id: "beta", subtitle: "Beta things" },
    ];

    expect(() =>
      groupProBenefits({ groups, benefits: [benefit("unnamespaced")] })
    ).toThrow(/"beta" claims no benefit/);
  });

  test("places every shipped benefit exactly once across the shipped groups", () => {
    const grouped = groupProBenefits(shared.paywall);

    expect(grouped.map((g: Group) => g.id)).toEqual(
      shared.paywall.groups.map((g) => g.id)
    );
    expect(grouped.flatMap((g: { benefits: Benefit[] }) => g.benefits)).toEqual(
      expect.arrayContaining(shared.paywall.benefits)
    );
    expect(
      grouped.reduce((n: number, g: { benefits: Benefit[] }) => n + g.benefits.length, 0)
    ).toBe(shared.paywall.benefits.length);
  });
});
