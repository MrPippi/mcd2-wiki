// Lets the component tests import .astro files; Vite compiles them through Astro's plugin at test time.
declare module "*.astro" {
  const Component: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default Component;
}
