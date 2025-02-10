module.exports = function (eleventyConfig) {
  // Copy static assets directly to output
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/css");

  // Watch for CSS changes
  eleventyConfig.addWatchTarget("./src/css/");

  let markdownIt = require("markdown-it");
  let markdownItOptions = {
    html: true,
    breaks: true,
    linkify: true,
  };

  eleventyConfig.setLibrary("md", markdownIt(markdownItOptions));

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
    },
    templateFormats: ["html", "md", "njk"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
