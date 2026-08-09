// Eleventy global data for the Pro Unlock section: the declared benefit
// groups, in order, each carrying the benefits its id namespace claims.
//
// Deriving this at build time rather than in the template is what makes an
// unplaceable benefit fail the build loudly instead of vanishing from the
// page — Nunjucks would happily render nothing.
const shared = require('./shared.json');
const {groupProBenefits} = require('../../scripts/pro-benefit-groups');

module.exports = () => ({
  groups: groupProBenefits(shared.paywall),
});
