// The jazzjam.app Worker: serves the Eleventy build from the static assets binding.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
