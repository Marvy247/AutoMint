/**
 * Tests for the registry contract calls in contracts.ts (#130).
 *
 * The stellar.ts helper module is mocked so these tests exercise only the
 * argument-building / result-decoding logic in contracts.ts.
 */

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    // Avoid strkey validation for placeholder addresses in unit tests.
    nativeToScVal: jest.fn((v: unknown) => ({ scv: v })),
  };
});

jest.mock("../stellar", () => ({
  __esModule: true,
  getServer: jest.fn(),
  simulateContractCall: jest.fn(),
}));

import { simulateContractCall } from "../stellar";
import {
  isRegistered,
  getTotalUsers,
  getUserProfile,
  getLeaderboard,
} from "../contracts";

const mockSimulate = simulateContractCall as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("isRegistered", () => {
  it("returns true when the registry reports the user as registered", async () => {
    mockSimulate.mockResolvedValue(true);
    await expect(isRegistered("GUSER")).resolves.toBe(true);
    expect(mockSimulate).toHaveBeenCalledWith(
      expect.any(String),
      "is_registered",
      expect.any(Array),
      "GUSER"
    );
  });

  it("returns false when the simulation throws", async () => {
    mockSimulate.mockRejectedValue(new Error("rpc down"));
    await expect(isRegistered("GUSER")).resolves.toBe(false);
  });
});

describe("getTotalUsers", () => {
  it("returns the numeric total on success", async () => {
    mockSimulate.mockResolvedValue(7);
    await expect(getTotalUsers("GSRC")).resolves.toBe(7);
    expect(mockSimulate).toHaveBeenCalledWith(
      expect.any(String),
      "total_users",
      [],
      "GSRC"
    );
  });

  it("returns 0 when the simulation throws", async () => {
    mockSimulate.mockRejectedValue(new Error("rpc down"));
    await expect(getTotalUsers("GSRC")).resolves.toBe(0);
  });
});

describe("getUserProfile", () => {
  it("parses the raw profile into a typed UserProfile", async () => {
    mockSimulate.mockResolvedValue({ username: "Alice", total_points: 350n });
    const profile = await getUserProfile("GUSER");
    expect(profile).toEqual({ username: "Alice", points: 350n });
  });

  it("returns null when the simulation throws", async () => {
    mockSimulate.mockRejectedValue(new Error("not registered"));
    await expect(getUserProfile("GUSER")).resolves.toBeNull();
  });
});

describe("getLeaderboard", () => {
  it("maps an array of raw profiles", async () => {
    mockSimulate.mockResolvedValue([
      { username: "A", total_points: 500n },
      { username: "B", total_points: 100n },
    ]);
    const lb = await getLeaderboard(10, "GSRC");
    expect(lb).toEqual([
      { username: "A", points: 500n },
      { username: "B", points: 100n },
    ]);
  });

  it("returns an empty array on error", async () => {
    mockSimulate.mockRejectedValue(new Error("boom"));
    await expect(getLeaderboard(10, "GSRC")).resolves.toEqual([]);
  });
});
