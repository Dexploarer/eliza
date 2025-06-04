import { vi } from 'vitest';
import {
  Content,
  IAgentRuntime,
  Memory,
  ModelType,
  Service,
  State,
  UUID,
  logger,
} from '@elizaos/core';

/**
 * Constructs a mock runtime object with default properties and mocked methods for use in tests.
 *
 * @param overrides - Optional properties or methods to override the default mock runtime.
 * @returns A mock runtime object suitable for testing agent runtime interactions.
 */
export function createMockRuntime(overrides: Partial<MockRuntime> = {}): MockRuntime {
  // Create base mock runtime with defaults
  const mockRuntime: MockRuntime = {
    // Core properties
    agentId: 'test-agent-id' as UUID,
    character: {
      name: 'Test Character',
      bio: 'This is a test character for testing',
    },
    services: new Map(),

    // Core methods
    getService: vi.fn().mockReturnValue(null),
    registerService: vi.fn(),
    getSetting: vi.fn().mockReturnValue(null),

    // Model methods
    useModel: vi.fn().mockImplementation((modelType, params) => {
      if (modelType === ModelType.TEXT_SMALL) {
        return Promise.resolve('Never gonna give you up, never gonna let you down');
      } else if (modelType === ModelType.TEXT_LARGE) {
        return Promise.resolve('Never gonna make you cry, never gonna say goodbye');
      } else if (modelType === ModelType.OBJECT_LARGE) {
        return Promise.resolve({
          thought: 'I should respond in a friendly way',
          message: 'Hello there! How can I help you today?',
        });
      }
      return Promise.resolve('Default response');
    }),

    // Additional methods used in tests
    init: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };

  // Merge with overrides
  return mockRuntime;
}

/**
 * Generates a mock Memory object with default properties for testing purposes.
 *
 * @param overrides - Properties to override the default mock values.
 * @returns A partial Memory object populated with test data and any provided overrides.
 */
export function createMockMemory(overrides: Partial<Memory> = {}): Partial<Memory> {
  return {
    id: 'test-message-id' as UUID,
    roomId: 'test-room-id' as UUID,
    entityId: 'test-entity-id' as UUID,
    agentId: 'test-agent-id' as UUID,
    content: {
      text: 'Test message',
      source: 'test',
    } as Content,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Generates a partial mock State object with default values for testing.
 *
 * The returned object includes a `values` property with a default `recentMessages` string, and a `data` property. Both can be customized via the {@link overrides} parameter.
 *
 * @param overrides - Properties to override in the default mock state.
 * @returns A partial State object suitable for use in tests.
 */
export function createMockState(overrides: Partial<State> = {}): Partial<State> {
  return {
    ...overrides,
    values: {
      recentMessages: 'User: Test message',
      ...overrides.values,
    },
    data: {
      ...overrides.data,
    },
  };
}

/**
 * Sets up a test environment with mock runtime, message, state, and a callback function.
 *
 * @param overrides - Optional overrides for the mock runtime, message, and state objects.
 * @returns An object containing the mock runtime, mock message, mock state, and a mocked callback function.
 */
export function setupTest(
  overrides: {
    runtimeOverrides?: Partial<MockRuntime>;
    messageOverrides?: Partial<Memory>;
    stateOverrides?: Partial<State>;
  } = {}
) {
  // Create mock callback function
  const callbackFn = vi.fn();

  // Create a message
  const mockMessage = createMockMemory(overrides.messageOverrides);

  // Create a state object
  const mockState = createMockState(overrides.stateOverrides);

  // Create a mock runtime
  const mockRuntime = createMockRuntime({
    ...overrides.runtimeOverrides,
  });

  return {
    mockRuntime,
    mockMessage,
    mockState,
    callbackFn,
  };
}

/**
 * Type definition for the mock runtime
 */
export interface MockRuntime {
  agentId: UUID;
  character: {
    name: string;
    bio: string;
    [key: string]: any;
  };
  services: Map<string, Service>;
  getService: ReturnType<typeof vi.fn>;
  registerService: ReturnType<typeof vi.fn>;
  getSetting: ReturnType<typeof vi.fn>;
  useModel: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
  [key: string]: any;
}

/**
 * Mocks all logger methods (`info`, `error`, `warn`, `debug`) with no-op implementations for testing.
 *
 * @returns A function that restores the original logger methods when called.
 */
export function setupLoggerSpies() {
  vi.spyOn(logger, 'info').mockImplementation(() => {});
  vi.spyOn(logger, 'error').mockImplementation(() => {});
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  vi.spyOn(logger, 'debug').mockImplementation(() => {});

  // allow tests to restore originals
  return () => vi.restoreAllMocks();
}
