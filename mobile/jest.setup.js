// Mock expo-secure-store and NetInfo for unit tests.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}))

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({ isConnected: true })),
  addEventListener: jest.fn(() => () => {}),
}))

jest.mock('expo-sqlite', () => {
  const store: Record<string, unknown[]> = {}
  return {
    openDatabaseSync: () => ({
      execAsync: jest.fn(async () => undefined),
      runAsync: jest.fn(async () => undefined),
      getFirstAsync: jest.fn(async () => null),
      getAllAsync: jest.fn(async () => []),
    }),
  }
})

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn(async () => ({ success: true })),
}))
