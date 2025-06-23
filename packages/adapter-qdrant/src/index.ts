import { qdrantDatabaseAdapter } from "./client";

const qdrantPlugin = {
    name: "qdrant",
    description: "Qdrant database adapter plugin",
    adapters: [qdrantDatabaseAdapter],
};
export default qdrantPlugin;
