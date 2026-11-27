/** The example apps, and the port each one is served on. */
export const APPS = [
  { name: 'lit', port: 5301 },
  { name: 'vue', port: 5302 },
  { name: 'react19', port: 5303 },
  { name: 'react18', port: 5304 },
  { name: 'react19-wrapper', port: 5305 },
  { name: 'react19-ssr', port: 5306 },
] as const;
