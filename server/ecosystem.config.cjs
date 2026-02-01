module.exports = {
  apps: [
    {
      name: "eurolooServer",
      script: "main.ts",
      interpreter: "node",
      node_args: "--loader ts-node/esm",
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
