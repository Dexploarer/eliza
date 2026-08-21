/**
 * Exercises bounded metadata normalization and the production managed-gateway
 * relay loop with deterministic HTTP and runtime collaborators.
 */
import { ChannelType, createUniqueUuid, type IAgentRuntime, type Memory } from "@elizaos/core";
import { describe, expect, it, vi } from "vitest";
import {
  CloudManagedGatewayRelayService,
  GATEWAY_RELAY_METADATA_MAX_BYTES,
  GATEWAY_RELAY_METADATA_MAX_DEPTH,
  GATEWAY_RELAY_METADATA_MAX_NODES,
  toJsonMetadataRecord,
} from "../../src/services/cloud-managed-gateway-relay";
import type { GatewayRelayRequest } from "../../src/types/cloud";

const AGENT_ID = "11111111-1111-4111-8111-111111111111";

function nestedMetadata(depth: number): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  let cursor = root;
  for (let index = 0; index < depth; index += 1) {
    const child: Record<string, unknown> = {};
    cursor.child = child;
    cursor = child;
  }
  return root;
}

function jsonResponse(body: unknown): { status: number; json: () => Promise<unknown> } {
  return {
    status: 200,
    json: async () => body,
  };
}

async function relayMessage(params: Record<string, unknown>) {
  const ensureConnection = vi.fn(async () => undefined);
  const handleMessage = vi.fn(async (_runtime, message: Memory) => {
    return { didRespond: false, responseContent: undefined, message };
  });
  const createMemory = vi.fn(async () => undefined);
  let submittedBody: unknown;
  let delivered = false;
  let resolveSubmitted: (() => void) | undefined;
  const submitted = new Promise<void>((resolve) => {
    resolveSubmitted = resolve;
  });

  const rpc: GatewayRelayRequest = {
    jsonrpc: "2.0",
    id: "rpc-1",
    method: "message.send",
    params,
  };

  const requestRaw = vi.fn(async (method: string, path: string, options?: { json?: unknown }) => {
    if (method === "POST" && path === "/eliza/gateway-relay/sessions") {
      return jsonResponse({
        success: true,
        data: { session: { id: "session-1" } },
      });
    }
    if (method === "GET" && path.endsWith("/next")) {
      if (!delivered) {
        delivered = true;
        return jsonResponse({
          success: true,
          data: { request: { requestId: "request-1", rpc, queuedAt: "2026-08-21T00:00:00Z" } },
        });
      }
      return jsonResponse({ success: true, data: { request: null } });
    }
    if (method === "POST" && path.endsWith("/responses")) {
      submittedBody = options?.json;
      resolveSubmitted?.();
      return jsonResponse({ success: true });
    }
    if (method === "DELETE") {
      return jsonResponse({ success: true });
    }
    throw new Error(`Unexpected relay request: ${method} ${path}`);
  });

  const authService = {
    isAuthenticated: () => true,
    getClient: () => ({ requestRaw }),
    getOrganizationId: () => "organization-1",
    getUserId: () => "user-1",
  };
  const runtime = {
    agentId: AGENT_ID,
    character: { name: "Relay Test" },
    messageService: { handleMessage },
    getService: (serviceType: string) => (serviceType === "CLOUD_AUTH" ? authService : null),
    ensureConnection,
    createMemory,
  } as unknown as IAgentRuntime;
  const service = new CloudManagedGatewayRelayService(runtime);
  expect(service.startRelayLoopIfReady()).toBe(true);

  const timeoutId = setTimeout(() => resolveSubmitted?.(), 2_000);
  await submitted;
  clearTimeout(timeoutId);
  if (submittedBody === undefined) {
    throw new Error("Timed out waiting for relay response");
  }
  await service.stop();

  return {
    createMemory,
    ensureConnection,
    handleMessage,
    runtime,
    submittedBody,
  };
}

describe("toJsonMetadataRecord", () => {
  it("returns undefined for non-record inputs", () => {
    expect(toJsonMetadataRecord(null)).toBeUndefined();
    expect(toJsonMetadataRecord(undefined)).toBeUndefined();
    expect(toJsonMetadataRecord("string")).toBeUndefined();
    expect(toJsonMetadataRecord(123)).toBeUndefined();
    expect(toJsonMetadataRecord(true)).toBeUndefined();
    expect(toJsonMetadataRecord([1, 2, 3])).toBeUndefined();
  });

  it("safely serializes valid metadata records", () => {
    const valid = {
      channelId: "12345",
      isDirect: true,
      count: 42,
      tags: ["alpha", "beta"],
      nested: { key: "value" },
    };

    expect(toJsonMetadataRecord(valid)).toEqual(valid);
  });

  it("fails closed to undefined on circular structures without throwing", () => {
    const circular: Record<string, unknown> = {
      name: "alice",
    };
    circular.self = circular;

    expect(toJsonMetadataRecord(circular)).toBeUndefined();
  });

  it("fails closed to undefined on objects with throwing getters", () => {
    const throwingObj = {
      get badProperty() {
        throw new Error("trap");
      },
    };

    expect(toJsonMetadataRecord(throwingObj)).toBeUndefined();
  });

  it("fails closed to undefined on non-serializable values such as BigInt", () => {
    expect(toJsonMetadataRecord({ n: 1n })).toBeUndefined();
  });

  it("fails closed to undefined when toJSON replaces the record root", () => {
    expect(toJsonMetadataRecord({ toJSON: () => 7 })).toBeUndefined();
    expect(toJsonMetadataRecord({ toJSON: () => null })).toBeUndefined();
    expect(toJsonMetadataRecord({ toJSON: () => [1, 2] })).toBeUndefined();
    expect(toJsonMetadataRecord({ toJSON: () => "scalar" })).toBeUndefined();
    expect(toJsonMetadataRecord({ toJSON: () => undefined })).toBeUndefined();
  });

  it("accepts toJSON replacements that remain plain records", () => {
    expect(toJsonMetadataRecord({ toJSON: () => ({ ok: true }) })).toEqual({ ok: true });
  });

  it("fails closed when metadata exceeds depth, node, or UTF-8 byte budgets", () => {
    expect(
      toJsonMetadataRecord(nestedMetadata(GATEWAY_RELAY_METADATA_MAX_DEPTH + 1))
    ).toBeUndefined();
    expect(
      toJsonMetadataRecord({ values: Array.from({ length: GATEWAY_RELAY_METADATA_MAX_NODES }) })
    ).toBeUndefined();
    expect(
      toJsonMetadataRecord({ value: "é".repeat(GATEWAY_RELAY_METADATA_MAX_BYTES) })
    ).toBeUndefined();
  });

  it("bounds sparse arrays without walking their declared length", () => {
    const sparse: unknown[] = [];
    sparse.length = GATEWAY_RELAY_METADATA_MAX_NODES + 1;

    expect(toJsonMetadataRecord({ sparse })).toBeUndefined();
  });
});

describe("CloudManagedGatewayRelayService metadata boundary", () => {
  it("uses normalized metadata consistently for connection identity and message memory", async () => {
    let transportReads = 0;
    const transportMetadata = {
      threadId: "pre-serialization-thread",
      toJSON: () => {
        transportReads += 1;
        return { threadId: "canonical-thread", tenant: "tenant-1" };
      },
    };

    const result = await relayMessage({
      source: "relay-test",
      roomId: "room-1",
      text: "hello",
      channelType: "dm",
      sender: {
        id: "sender-1",
        username: "alice",
        metadata: { toJSON: () => ({ role: "owner" }) },
      },
      metadata: transportMetadata,
    });

    expect(transportReads).toBe(1);
    expect(result.ensureConnection).toHaveBeenCalledOnce();
    expect(result.ensureConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: createUniqueUuid(result.runtime, "gateway:relay-test:thread:canonical-thread"),
        metadata: { threadId: "canonical-thread", tenant: "tenant-1" },
      })
    );
    expect(result.handleMessage).toHaveBeenCalledOnce();
    const relayedMessage = result.handleMessage.mock.calls[0]?.[1];
    expect(relayedMessage).toMatchObject({
      content: { text: "hello", source: "relay-test", channelType: ChannelType.DM },
      metadata: {
        entityName: "alice",
        entityUserName: "alice",
        gatewaySender: { role: "owner" },
        gatewayMetadata: { threadId: "canonical-thread", tenant: "tenant-1" },
      },
    });
    expect(result.submittedBody).toMatchObject({
      requestId: "request-1",
      response: { jsonrpc: "2.0", id: "rpc-1", result: { didRespond: false } },
    });
  });

  it.each([
    [
      "circular",
      () => {
        const value: Record<string, unknown> = {};
        value.self = value;
        return value;
      },
    ],
    [
      "throwing getter",
      () => ({
        get value() {
          throw new Error("trap");
        },
      }),
    ],
    ["BigInt", () => ({ value: 1n })],
    ["root-replacing toJSON", () => ({ toJSON: () => ["not", "a", "record"] })],
    ["over-depth", () => nestedMetadata(GATEWAY_RELAY_METADATA_MAX_DEPTH + 1)],
    ["over-node", () => ({ values: Array.from({ length: GATEWAY_RELAY_METADATA_MAX_NODES }) })],
    ["over-byte", () => ({ value: "x".repeat(GATEWAY_RELAY_METADATA_MAX_BYTES + 1) })],
  ])("drops %s metadata while continuing the production relay", async (_label, makeMetadata) => {
    const metadata = makeMetadata();
    const result = await relayMessage({
      source: "relay-test",
      roomId: "room-1",
      text: "still delivered",
      sender: { id: "sender-1", metadata },
      metadata,
    });

    expect(result.ensureConnection).toHaveBeenCalledOnce();
    expect(result.ensureConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: createUniqueUuid(result.runtime, "gateway:relay-test:room:room-1"),
        metadata: undefined,
      })
    );
    expect(result.handleMessage).toHaveBeenCalledOnce();
    const relayedMessage = result.handleMessage.mock.calls[0]?.[1];
    expect(relayedMessage?.metadata).not.toHaveProperty("gatewaySender");
    expect(relayedMessage?.metadata).not.toHaveProperty("gatewayMetadata");
    expect(result.submittedBody).toMatchObject({
      response: { result: { didRespond: false } },
    });
  });

  it("contains a throwing metadata property getter and still delivers the message", async () => {
    let metadataReads = 0;
    const params: Record<string, unknown> = {
      source: "relay-test",
      roomId: "room-1",
      text: "getter-safe",
      sender: { id: "sender-1" },
    };
    Object.defineProperty(params, "metadata", {
      enumerable: true,
      get() {
        metadataReads += 1;
        throw new Error("metadata trap");
      },
    });

    const result = await relayMessage(params);

    expect(metadataReads).toBe(1);
    expect(result.ensureConnection).toHaveBeenCalledOnce();
    expect(result.handleMessage).toHaveBeenCalledOnce();
  });

  it("uses the room identity and omits metadata fields when metadata is absent", async () => {
    const result = await relayMessage({
      source: "relay-test",
      roomId: "room-without-metadata",
      text: "metadata is optional",
      sender: { id: "sender-1" },
    });

    expect(result.ensureConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: createUniqueUuid(result.runtime, "gateway:relay-test:room:room-without-metadata"),
        metadata: undefined,
      })
    );
    const relayedMessage = result.handleMessage.mock.calls[0]?.[1];
    expect(relayedMessage?.metadata).not.toHaveProperty("gatewaySender");
    expect(relayedMessage?.metadata).not.toHaveProperty("gatewayMetadata");
  });

  it("rejects an empty relay payload before creating connection or message side effects", async () => {
    const result = await relayMessage({
      source: "relay-test",
      roomId: "room-1",
      text: "   ",
      metadata: { threadId: "ignored" },
    });

    expect(result.ensureConnection).not.toHaveBeenCalled();
    expect(result.handleMessage).not.toHaveBeenCalled();
    expect(result.createMemory).not.toHaveBeenCalled();
    expect(result.submittedBody).toMatchObject({
      response: { error: { code: -32602, message: "Invalid message relay payload" } },
    });
  });
});
