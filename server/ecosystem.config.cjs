module.exports = {
  apps: [
    {
      name: "eurolooServer",
      script: "main.ts",
      interpreter: "node",
      node_args: ["--loader", "ts-node/esm", "--inspect=127.0.0.1:9229"],
      env: {
        NODE_ENV: "development",
      },
    },
  ],
};
