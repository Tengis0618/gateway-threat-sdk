
const path = require("path");
const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

/**
 * Metro needs to see the monorepo root so that workspace symlinks
 * for @gateway/pay-react-native and @gateway/pay-core resolve.
 */
const config = {
    projectRoot,
    watchFolders: [workspaceRoot],
    resolver: {
        nodeModulesPaths: [
            path.resolve(projectRoot, "node_modules"),
            path.resolve(workspaceRoot, "node_modules"),
        ],
        disableHierarchicalLookup: false,
    },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
