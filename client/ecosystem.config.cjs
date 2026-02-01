const path = require('path');

module.exports = {
  apps: [
    {
      name: "eurolooClient",
      cwd: __dirname, // Ensure it runs from this directory
      script: "node_modules/next/dist/bin/next",
      args: "dev",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
    },
  ],
};
