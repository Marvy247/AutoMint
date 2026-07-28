import { parseUserProfile, parseBotNFT, parseListing } from "./contracts";

describe("parse helpers in contracts.ts", () => {
  describe("parseUserProfile", () => {
    it("parses correctly with bigint points", () => {
      const raw = { username: "alice", points: 100n };
      const parsed = parseUserProfile(raw);
      expect(parsed).toEqual({ username: "alice", points: 100n });
    });

    it("parses correctly with number points", () => {
      const raw = { username: "bob", points: 50 };
      const parsed = parseUserProfile(raw);
      expect(parsed).toEqual({ username: "bob", points: 50n });
    });
  });

  describe("parseBotNFT", () => {
    const baseRaw = {
      id: 1n,
      name: "Bot1",
      owner: "GBDUJF...",
      accrual_rate: 10n,
      minted_at: 123456789,
      last_claim_timestamp: 123456789n,
    };

    it("parses tier as string", () => {
      const parsed = parseBotNFT({ ...baseRaw, tier: "Premium" });
      expect(parsed.tier).toBe("Premium");
    });

    it("parses tier as array", () => {
      const parsed = parseBotNFT({ ...baseRaw, tier: [0, "Enterprise"] });
      expect(parsed.tier).toBe("Enterprise");
    });

    it("parses tier as object with variant", () => {
      const parsed = parseBotNFT({ ...baseRaw, tier: { variant: "Pro" } });
      expect(parsed.tier).toBe("Pro");
    });

    it("parses tier as object with tag", () => {
      const parsed = parseBotNFT({ ...baseRaw, tier: { tag: "Pro" } });
      expect(parsed.tier).toBe("Pro");
    });

    it("defaults to Basic if tier format is unknown", () => {
      const parsed = parseBotNFT({ ...baseRaw, tier: { foo: "bar" } });
      expect(parsed.tier).toBe("Basic");
    });

    it("parses missing fields gracefully", () => {
      const parsed = parseBotNFT({});
      expect(parsed.id).toBe(0n);
      expect(parsed.name).toBe("");
      expect(parsed.owner).toBe("");
      expect(parsed.tier).toBe("Basic");
      expect(parsed.accrual_rate).toBe(0n);
      expect(parsed.minted_at).toBe(0);
      expect(parsed.last_claim_timestamp).toBe(0n);
    });
  });

  describe("parseListing", () => {
    it("parses listing correctly", () => {
      const raw = {
        id: 100n,
        seller: "GBDUJF...",
        bot_id: 5n,
        price: 500n,
        listed_at: 123456789n,
      };
      const parsed = parseListing(raw);
      expect(parsed).toEqual(raw);
    });

    it("parses missing fields gracefully", () => {
      const parsed = parseListing({});
      expect(parsed.id).toBe(0n);
      expect(parsed.seller).toBe("");
      expect(parsed.bot_id).toBe(0n);
      expect(parsed.price).toBe(0n);
      expect(parsed.listed_at).toBe(0n);
    });
  });
});
