import { v4,v5 } from "uuid";
import { QdrantClient } from "@qdrant/js-client-rest";
import {
    Account,
    Actor,
    GoalStatus,
    IDatabaseCacheAdapter,
    UUID,
    elizaLogger,
    RAGKnowledgeItem,
    DatabaseAdapter,
    Participant,
    type Memory,
    type Goal,
    type Relationship,
    type IAgentRuntime,
    type Adapter,
    type Plugin,
} from "@elizaos/core";

class QdrantDatabaseAdapter  extends DatabaseAdapter<QdrantClient>  implements IDatabaseCacheAdapter {
    db: QdrantClient;
    collectionName: string = 'collection';
    qdrantV5UUIDNamespace: string = "00000000-0000-0000-0000-000000000000";
    cacheM: Map<string, string> = new Map<string, string>();
    vectorSize: number;
    // In-memory stores for non-knowledge features
    private memories: Map<UUID, (Memory & { tableName: string })> = new Map();
    private roomMemories: Map<UUID, Set<UUID>> = new Map();
    private agentMemories: Map<UUID, Set<UUID>> = new Map();
    private participants: Map<UUID, Set<UUID>> = new Map();
    private participantStates: Map<string, 'FOLLOWED' | 'MUTED' | null> = new Map();
    constructor(url: string, apiKey: string, port: number, vectorSize: number) {
        super();
        elizaLogger.info("new Qdrant client...");
        this.db = new QdrantClient({
                url: url,
                apiKey:apiKey,
                port: port,
        });
       this.vectorSize = vectorSize;
    }

    private preprocess(content: string): string {
        if (!content || typeof content !== "string") {
            elizaLogger.warn("Invalid input for preprocessing");
            return "";
        }
       const processedContent =  content
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`.*?`/g, "")
        .replace(/#{1,6}\s*(.*)/g, "$1")
        .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/(https?:\/\/)?(www\.)?([^\s]+\.[^\s]+)/g, "$3")
        .replace(/<@[!&]?\d+>/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/^\s*[-*_]{3,}\s*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*/g, "")
        .replace(/\s+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[^a-zA-Z0-9\s\-_./:?=&]/g, "")
        .trim()
        return processedContent
    }

    async init () {
        const response = await this.db.getCollections();
        const collectionNames = response.collections.map((collection) => collection.name);
        if (collectionNames.includes(this.collectionName)) {
            elizaLogger.info("Collection already exists.");
        } else {
            elizaLogger.info("create collection...");
            await this.db.createCollection(this.collectionName, {
                vectors: {
                    size: this.vectorSize,
                    distance: 'Cosine',
                },
            });
        }
    }

    async createKnowledge(knowledge: RAGKnowledgeItem): Promise<void> {
        const metadata = knowledge.content.metadata || {}
        elizaLogger.info("Qdrant adapter createKnowledge id:", knowledge.id);
        await this.db.upsert(this.collectionName, {
            wait: true,
            points: [
                {
                    id: this.buildQdrantID(knowledge.id), // the qdrant id must be a standard uuid
                    vector: knowledge.embedding ? Array.from(knowledge.embedding) : [],
                    payload:{
                        agentId:  metadata.isShared ? null : knowledge.agentId,
                        content: {
                           text: knowledge.content.text,
                           metadata: metadata
                        },
                        createdAt: knowledge.createdAt || Date.now(),
                        isMain:  metadata.isMain || false,
                        originalId: metadata.originalId || null,
                        chunkIndex: metadata.chunkIndex || null,
                        isShared : metadata.isShared || false
                    }
                }
            ],
        })
    }

    async getKnowledge(params: {
        query?: string;
        id?: UUID;
        conversationContext?: string;
        limit?: number;
        agentId?: UUID;
    }): Promise<RAGKnowledgeItem[]> {
        elizaLogger.info("Qdrant adapter getKnowledge...", params.id);
        const rows = await this.db.retrieve(this.collectionName, {
            ids: params.id ? [params.id.toString()] : [],
        });
        const results: RAGKnowledgeItem[] = rows.map((row) => {
            const contentObj = typeof row.payload?.content === "string"
            ? JSON.parse(row.payload.content)
            : row.payload?.content;
            return {
                id: row.id.toString() as UUID,
                agentId: (row.payload?.agentId || "") as UUID,
                content: {
                    text: String(contentObj.text || ""),
                    metadata: contentObj.metadata as { [key: string]: unknown }
                },
                embedding: row.vector ? Float32Array.from(row.vector as number[]) : undefined,
                createdAt: row.payload?.createdAt as number
            };
        });
        return results;
    }

    async processFile(file: { path: string; content: string; type: "pdf" | "md" | "txt"; isShared: boolean }): Promise<void> {
        return Promise.resolve(undefined);
    }

    async removeKnowledge(id: UUID): Promise<void> {
        return Promise.resolve(undefined);
    }

    async searchKnowledge(params: {
        agentId: UUID;
        embedding: Float32Array | number[];
        match_threshold?: number;
        match_count?: number;
        searchText?: string
    }): Promise<RAGKnowledgeItem[]> {
        const cacheKey = `${params.agentId}:${params.embedding.toString()}`;
            const cachedResult = await this.getCache({
                key: cacheKey,
                agentId: params.agentId
            });

            if (cachedResult) {
                return JSON.parse(cachedResult);
            }
        const rows = await this.db.search(this.collectionName, {
            vector:  Array.from(params.embedding),
            with_vector: true
        });

        const results: RAGKnowledgeItem[] = rows.map((row) => {
            const contentObj = typeof row.payload?.content === "string"
            ? JSON.parse(row.payload.content)
            : row.payload?.content;
            elizaLogger.info("Qdrant adapter searchKnowledge  id:", row.id.toString() as UUID);
            return {
                id: row.id.toString() as UUID,
                agentId: (row.payload?.agentId || "") as UUID,
                content: {
                    text: String(contentObj.text || ""),
                    metadata: contentObj.metadata as { [key: string]: unknown }
                },
                embedding: row.vector ? Float32Array.from(row.vector as number[]) : undefined,
                createdAt: row.payload?.createdAt as number,
                similarity: row.score || 0
            };
        });
        elizaLogger.debug("Qdrant adapter searchKnowledge results:", results);
        await this.setCache({
            key: cacheKey,
            agentId: params.agentId,
            value: JSON.stringify(results)
        });
        return results;
    }

    async addParticipant(userId: UUID, roomId: UUID): Promise<boolean> {
        const set = this.participants.get(roomId) || new Set<UUID>();
        const existed = set.has(userId);
        set.add(userId);
        this.participants.set(roomId, set);
        return !existed;
    }

    async clearKnowledge(agentId: UUID, shared?: boolean): Promise<void> {
        return Promise.resolve(undefined);
    }

    async close(): Promise<void> {
        return Promise.resolve(undefined);
    }

    async countMemories(roomId: UUID, unique?: boolean, tableName?: string): Promise<number> {
        const ids = this.roomMemories.get(roomId);
        if (!ids) return 0;
        let mems = Array.from(ids).map((id) => this.memories.get(id)!);
        if (tableName) mems = mems.filter((m) => m.tableName === tableName);
        if (unique) mems = mems.filter((m) => m.unique);
        return mems.length;
    }

    async createAccount(account: Account): Promise<boolean> {
        return Promise.resolve(false);
    }

    async createGoal(goal: Goal): Promise<void> {
        return Promise.resolve(undefined);
    }

    async createMemory(memory: Memory, tableName: string, unique?: boolean): Promise<void> {
        const mem = { ...memory, tableName, unique: unique ?? memory.unique } as Memory & { tableName: string };
        this.memories.set(mem.id, mem);
        if (mem.roomId) {
            const set = this.roomMemories.get(mem.roomId) || new Set<UUID>();
            set.add(mem.id);
            this.roomMemories.set(mem.roomId, set);
        }
        if (mem.agentId) {
            const set = this.agentMemories.get(mem.agentId) || new Set<UUID>();
            set.add(mem.id);
            this.agentMemories.set(mem.agentId, set);
        }
    }

    async createRelationship(params: { userA: UUID; userB: UUID }): Promise<boolean> {
        return Promise.resolve(false);
    }

    async createRoom(roomId?: UUID): Promise<UUID> {
        const newRoomId = roomId || v4();
        return newRoomId as UUID;
    }

    async getAccountById(userId: UUID): Promise<Account | null> {
        return null;
    }

    async getActorDetails(params: { roomId: UUID }): Promise<Actor[]> {
        return Promise.resolve([]);
    }

    async getCachedEmbeddings(params: {
        query_table_name: string;
        query_threshold: number;
        query_input: string;
        query_field_name: string;
        query_field_sub_name: string;
        query_match_count: number
    }): Promise<{ embedding: number[]; levenshtein_score: number }[]> {
        return Promise.resolve([]);
    }

    async getGoals(params: {
        agentId: UUID;
        roomId: UUID;
        userId?: UUID | null;
        onlyInProgress?: boolean;
        count?: number
    }): Promise<Goal[]> {
        return Promise.resolve([]);
    }

    async getMemories(params: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
        agentId: UUID;
        start?: number;
        end?: number
    }): Promise<Memory[]> {
        const ids = this.roomMemories.get(params.roomId);
        if (!ids) return [];
        let mems = Array.from(ids).map((id) => this.memories.get(id)!);
        mems = mems.filter((m) => m.tableName === params.tableName && m.agentId === params.agentId);
        if (params.unique) mems = mems.filter((m) => m.unique);
        if (params.start) mems = mems.filter((m) => m.createdAt >= params.start!);
        if (params.end) mems = mems.filter((m) => m.createdAt <= params.end!);
        mems.sort((a, b) => b.createdAt - a.createdAt);
        if (params.count) mems = mems.slice(0, params.count);
        return mems;
    }

    async getMemoriesByRoomIds(params: { tableName: string; agentId: UUID; roomIds: UUID[] }): Promise<Memory[]> {
        let results: Memory[] = [];
        for (const roomId of params.roomIds) {
            const mems = await this.getMemories({
                roomId,
                tableName: params.tableName,
                agentId: params.agentId,
            });
            results = results.concat(mems);
        }
        return results;
    }

    async getMemoryById(id: UUID): Promise<Memory | null> {
        return this.memories.get(id) || null;
    }

    async getParticipantUserState(roomId: UUID, userId: UUID): Promise<"FOLLOWED" | "MUTED" | null> {
        return this.participantStates.get(`${roomId}:${userId}`) ?? null;
    }

    async getParticipantsForAccount(userId: UUID): Promise<Participant[]> {
        const result: Participant[] = [];
        for (const [roomId, set] of this.participants.entries()) {
            if (set.has(userId)) {
                result.push({ id: userId, entity: { id: userId } as any });
            }
        }
        return result;
    }

    async getParticipantsForRoom(roomId: UUID): Promise<UUID[]> {
        return Array.from(this.participants.get(roomId) || []);
    }

    async  getRelationship(params: { userA: UUID; userB: UUID }): Promise<Relationship | null> {
        return null;
    }

    async getRelationships(params: { userId: UUID }): Promise<Relationship[]> {
        return Promise.resolve([]);
    }

    async getRoom(roomId: UUID): Promise<UUID | null> {
        return null;
    }

    async getRoomsForParticipant(userId: UUID): Promise<UUID[]> {
        const rooms: UUID[] = [];
        for (const [roomId, set] of this.participants.entries()) {
            if (set.has(userId)) rooms.push(roomId);
        }
        return rooms;
    }

    async getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]> {
        const rooms = new Set<UUID>();
        for (const userId of userIds) {
            for (const roomId of await this.getRoomsForParticipant(userId)) {
                rooms.add(roomId);
            }
        }
        return Array.from(rooms);
    }

    async log(params: { body: { [p: string]: unknown }; userId: UUID; roomId: UUID; type: string }): Promise<void> {
        return Promise.resolve(undefined);
    }

    async removeAllGoals(roomId: UUID): Promise<void> {
        return Promise.resolve(undefined);
    }

    async removeAllMemories(roomId: UUID, tableName: string): Promise<void> {
        const ids = this.roomMemories.get(roomId);
        if (!ids) return;
        for (const id of Array.from(ids)) {
            const mem = this.memories.get(id);
            if (mem && mem.tableName === tableName) {
                this.memories.delete(id);
                ids.delete(id);
                const set = this.agentMemories.get(mem.agentId);
                set?.delete(id);
            }
        }
    }

    async removeGoal(goalId: UUID): Promise<void> {
        return Promise.resolve(undefined);
    }

    async removeMemory(memoryId: UUID, tableName: string): Promise<void> {
        const mem = this.memories.get(memoryId);
        if (!mem || mem.tableName !== tableName) return;
        this.memories.delete(memoryId);
        this.roomMemories.get(mem.roomId)?.delete(memoryId);
        this.agentMemories.get(mem.agentId)?.delete(memoryId);
    }

    async removeParticipant(userId: UUID, roomId: UUID): Promise<boolean> {
        const set = this.participants.get(roomId);
        if (!set) return false;
        const existed = set.delete(userId);
        if (set.size === 0) this.participants.delete(roomId);
        this.participantStates.delete(`${roomId}:${userId}`);
        return existed;
    }

    async removeRoom(roomId: UUID): Promise<void> {
        return Promise.resolve(undefined);
    }

    async searchMemories(params: {
        tableName: string;
        agentId: UUID;
        roomId: UUID;
        embedding: number[];
        match_threshold: number;
        match_count: number;
        unique: boolean
    }): Promise<Memory[]> {
        return this.searchMemoriesByEmbedding(params.embedding, {
            match_threshold: params.match_threshold,
            count: params.match_count,
            roomId: params.roomId,
            agentId: params.agentId,
            unique: params.unique,
            tableName: params.tableName,
        });
    }

    async searchMemoriesByEmbedding(embedding: number[], params: {
        match_threshold?: number;
        count?: number;
        roomId?: UUID;
        agentId?: UUID;
        unique?: boolean;
        tableName: string
    }): Promise<Memory[]> {
        const all = Array.from(this.memories.values()).filter((m) => {
            if (params.tableName && m.tableName !== params.tableName) return false;
            if (params.roomId && m.roomId !== params.roomId) return false;
            if (params.agentId && m.agentId !== params.agentId) return false;
            if (params.unique && !m.unique) return false;
            return Array.isArray(m.embedding);
        });
        const scored = all.map((m) => ({
            memory: m,
            score: this.cosineSimilarity(m.embedding as number[], embedding),
        }));
        const threshold = params.match_threshold ?? -1;
        let results = scored.filter((s) => s.score >= threshold);
        results.sort((a, b) => b.score - a.score);
        if (params.count) results = results.slice(0, params.count);
        return results.map((r) => r.memory);
    }

    async setParticipantUserState(roomId: UUID, userId: UUID, state: "FOLLOWED" | "MUTED" | null): Promise<void> {
        this.participantStates.set(`${roomId}:${userId}`, state);
    }

    async updateGoal(goal: Goal): Promise<void> {
        return Promise.resolve(undefined);
    }

    async updateGoalStatus(params: { goalId: UUID; status: GoalStatus }): Promise<void> {
        return Promise.resolve(undefined);
    }

    getMemoriesByIds(memoryIds: UUID[], tableName?: string): Promise<Memory[]> {
        const results: Memory[] = [];
        for (const id of memoryIds) {
            const mem = this.memories.get(id);
            if (mem && (!tableName || mem.tableName === tableName)) {
                results.push(mem);
            }
        }
        return Promise.resolve(results);
    }

    async getCache(params: {
        key: string;
        agentId: UUID;
    }): Promise<string | undefined> {
        let key = this.buildKey(params.agentId, params.key);
        let result = this.cacheM.get(key);
        return result;
    }

    async setCache(params: {
        key: string;
        agentId: UUID;
        value: string;
    }): Promise<boolean> {
        this.cacheM.set(this.buildKey(params.agentId, params.key),params.value)
        return true;
    }

    async deleteCache(params: {
        key: string;
        agentId: UUID;
    }): Promise<boolean> {
        const key = this.buildKey(params.agentId, params.key);
        return this.cacheM.delete(key);
    }

    private buildKey(agentId: UUID, key: string): string {
        return `${agentId}:${key}`;
    }

    private buildQdrantID(id: string): string{
       return v5(id,this.qdrantV5UUIDNamespace);
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length || a.length === 0) return 0;
        let dot = 0;
        let magA = 0;
        let magB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        if (magA === 0 || magB === 0) return 0;
        return dot / (Math.sqrt(magA) * Math.sqrt(magB));
    }
}

export const qdrantDatabaseAdapter: Adapter = {
    init: (runtime: IAgentRuntime) => {
        const QDRANT_URL = runtime.getSetting("QDRANT_URL");
        const QDRANT_KEY = runtime.getSetting("QDRANT_KEY"); 
        const QDRANT_PORT = runtime.getSetting("QDRANT_PORT");
        const QDRANT_VECTOR_SIZE = runtime.getSetting("QDRANT_VECTOR_SIZE");

        if (
            QDRANT_URL &&
            QDRANT_KEY &&
            QDRANT_PORT &&
            QDRANT_VECTOR_SIZE
        ) {
            elizaLogger.info("Initializing Qdrant adapter...");
            const db = new QdrantDatabaseAdapter(
                QDRANT_URL,
                QDRANT_KEY,
                Number(QDRANT_PORT),
                Number(QDRANT_VECTOR_SIZE)
            );
            return db;
        } else {
            throw new Error("QDRANT_URL, QDRANT_KEY, QDRANT_PORT, and QDRANT_VECTOR_SIZE are not set");
        }
    },
};
