import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BotCard from "../components/dashboard/BotCard";
import type { BotNFT } from "@/types";

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const baseBot: BotNFT = {
  id: 42n,
  name: "Ada Bot",
  owner: "GABC1234",
  tier: "Gold",
  accrual_rate: 10n,
  minted_at: 1_700_000_000,
  last_claim_timestamp: 0n,
};

describe("BotCard Component", () => {
  it("renders the bot name, id, tier, rate and minted date", () => {
    render(<BotCard bot={baseBot} />);

    expect(screen.getByText("Ada Bot")).toBeInTheDocument();
    expect(screen.getByText("#42")).toBeInTheDocument();
    expect(screen.getAllByText("Gold").length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        (_, element) => element?.tagName === "P" && element.textContent === "10 pt/hr"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("pt/hr")).toBeInTheDocument();
    expect(screen.getByText(formatDate(baseBot.minted_at))).toBeInTheDocument();
  });

  it("falls back to the tier name when the bot has no name", () => {
    const bot = { ...baseBot, name: "" };
    render(<BotCard bot={bot} />);

    expect(screen.getAllByText("Gold").length).toBe(2);
  });

  it("does not render the 'List for Sale' button when onListForSale is not provided", () => {
    render(<BotCard bot={baseBot} />);

    expect(screen.queryByRole("button", { name: /list for sale/i })).not.toBeInTheDocument();
  });

  it("renders the 'List for Sale' button and calls onListForSale with the bot id when clicked", async () => {
    const user = userEvent.setup();
    const onListForSale = jest.fn();

    render(<BotCard bot={baseBot} onListForSale={onListForSale} />);

    const button = screen.getByRole("button", { name: /list for sale/i });
    expect(button).toBeInTheDocument();

    await user.click(button);

    expect(onListForSale).toHaveBeenCalledTimes(1);
    expect(onListForSale).toHaveBeenCalledWith(baseBot.id);
  });

  it("renders an unknown tier gracefully", () => {
    const bot = { ...baseBot, name: "", tier: "Mystery" as unknown as BotNFT["tier"] };
    render(<BotCard bot={bot} />);

    expect(screen.getAllByText("Unknown").length).toBe(2);
  });
});
