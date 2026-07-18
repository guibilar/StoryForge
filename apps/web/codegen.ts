import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "../api/src/**/graphql/schema/**/*.graphql",
  documents: "src/**/*.graphql",
  generates: {
    "src/gql/": {
      preset: "client",
      config: {
        useTypeImports: true,
        scalars: {
          Upload: "File",
        },
      },
    },
  },
};

export default config;
