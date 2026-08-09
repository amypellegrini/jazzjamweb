/**
 * Splits the generated Pro benefits into the groups the shared content
 * declares, for the Pro Unlock section of src/index.html.
 *
 * Membership is *derived*, never listed: a benefit id names its group
 * ("export-midi" belongs to "export"), and the group flagged `catchAll` takes
 * every benefit no namespace claims — which is how "all-keys-cycle" reaches
 * the practice group. That is the same derivation the workbench validates in
 * scripts/sync.mjs and the app applies in its paywall, so adding a benefit in
 * the workbench lands it in the right group here with no template edit, and
 * the three surfaces cannot disagree about what an export format is.
 *
 * The rule is re-derived here rather than read off the data because this repo
 * is checked out standalone by CI and the Pages deploy: whatever the workbench
 * validated at sync time, the site has only src/_data/shared.json to go on.
 * Anything that cannot be placed throws, which fails the Eleventy build — a
 * benefit must never be dropped from the page or appended to some arbitrary
 * group.
 *
 * See SHARED_CONTENT_SPEC.md.
 */

/**
 * @param {{groups?: Array<{id: string, subtitle: string, catchAll?: boolean}>,
 *          benefits?: Array<{id: string, name: string, description: string}>}} paywall
 * @returns {Array<{id: string, subtitle: string, benefits: Array<object>}>}
 *   the declared groups in declaration order, each carrying its own benefits
 */
function groupProBenefits(paywall) {
  const {groups, benefits} = paywall || {};
  if (!Array.isArray(groups) || groups.length === 0) {
    throw new Error('shared.paywall.groups must be a non-empty array — regenerate src/_data/shared.json from the workbench.');
  }
  if (!Array.isArray(benefits) || benefits.length === 0) {
    throw new Error('shared.paywall.benefits must be a non-empty array — regenerate src/_data/shared.json from the workbench.');
  }

  const ids = groups.map(group => group.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate) {
    throw new Error(`shared.paywall.groups declares "${duplicate}" twice — group ids must be unique.`);
  }

  const catchAll = groups.filter(group => group.catchAll === true);
  if (catchAll.length > 1) {
    throw new Error(
      `shared.paywall.groups flags more than one group as catchAll (${catchAll.map(g => g.id).join(', ')}) — ` +
        'a benefit outside every namespace would map to more than one group.',
    );
  }

  const members = new Map(groups.map(group => [group.id, []]));
  for (const benefit of benefits) {
    const claiming = groups.filter(group => benefit.id.startsWith(`${group.id}-`));
    if (claiming.length > 1) {
      throw new Error(
        `Pro benefit "${benefit.id}" maps to more than one group (${claiming.map(g => g.id).join(', ')}) — ` +
          'group id namespaces must not overlap.',
      );
    }
    const group = claiming[0] || catchAll[0];
    if (!group) {
      throw new Error(
        `Pro benefit "${benefit.id}" maps to no declared group (${ids.join(', ')}). ` +
          'Namespace its id under a group id in the workbench, or flag the group that takes unnamespaced benefits with "catchAll": true.',
      );
    }
    members.get(group.id).push(benefit);
  }

  for (const group of groups) {
    if (members.get(group.id).length === 0) {
      throw new Error(`Pro benefit group "${group.id}" claims no benefit — it would render a subtitle with no cards under it.`);
    }
  }

  return groups.map(group => ({
    id: group.id,
    subtitle: group.subtitle,
    benefits: members.get(group.id),
  }));
}

module.exports = {groupProBenefits};
