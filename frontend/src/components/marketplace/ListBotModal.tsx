"use client";

import { useState, useMemo, useId } from "react";
import { toast } from "sonner";
import Modal from "@/components/ui/Modal";
import { useListBot } from "@/hooks/useMarketplace";
import { xlmToStroops, stroopsToXlm } from "@/types";
import type { BotNFT } from "@/types";

const FEE_PERCENT = 2.5;
const NET_PERCENT = 100 - FEE_PERCENT;

interface ListBotModalProps {
  bot: BotNFT;
  isOpen: boolean;
  onClose: () => void;
}

export default function ListBotModal({ bot, isOpen, onClose }: ListBotModalProps) {
  const [priceXlm, setPriceXlm] = useState("");
  const listBot = useListBot();
  const priceInputId = useId();

  const priceNum = useMemo(() => {
    const n = parseFloat(priceXlm);
    return isNaN(n) || n <= 0 ? 0 : n;
  }, [priceXlm]);

  const fee = useMemo(() => (priceNum * FEE_PERCENT) / 100, [priceNum]);
  const net = useMemo(() => (priceNum * NET_PERCENT) / 100, [priceNum]);

  const handleSubmit = async () => {
    if (priceNum <= 0) return;
    const priceStroops = xlmToStroops(priceNum);
    listBot.mutate(
      { botId: bot.id, price: priceStroops },
      {
        onSuccess: () => {
          toast.success(`${bot.name} listed for ${priceNum} XLM`);
          onClose();
          setPriceXlm("");
        },
        // #199 — previously silent: a failed listing gave the user no
        // feedback at all beyond the button reverting to its idle label.
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Failed to list bot for sale. Please try again.",
          );
        },
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`List ${bot.name} for Sale`}>
      <div className="flex flex-col gap-5">
        {/* Price input */}
        <label htmlFor={priceInputId} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-muted">Price (XLM)</span>
          <input
            id={priceInputId}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={priceXlm}
            onChange={(e) => setPriceXlm(e.target.value)}
            aria-describedby={priceNum > 0 ? `${priceInputId}-fee` : undefined}
            className="rounded-xl border border-liner bg-card-2 px-4 py-3 text-lg text-text placeholder:text-muted/50 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
          />
        </label>

        {/* Live fee breakdown */}
        {priceNum > 0 && (
          <div
            id={`${priceInputId}-fee`}
            role="status"
            aria-live="polite"
            className="rounded-xl border border-liner bg-card p-4 text-sm"
          >
            <div className="flex items-center justify-between text-muted">
              <span>Marketplace fee ({FEE_PERCENT}%)</span>
              <span>-{fee.toFixed(4)} XLM</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-liner pt-2 font-semibold text-text">
              <span>You receive ({NET_PERCENT}%)</span>
              <span className="text-green">{net.toFixed(4)} XLM</span>
            </div>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={priceNum <= 0 || listBot.isPending}
          aria-busy={listBot.isPending}
          className="btn-primary w-full py-3 text-base"
        >
          {listBot.isPending ? "Listing…" : "List for Sale"}
        </button>
      </div>
    </Modal>
  );
}
