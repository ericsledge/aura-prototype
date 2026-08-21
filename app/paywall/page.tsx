"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { track } from "@/lib/analytics/events";

const FEATURES = [
  "Unlimited rescans",
  "Full category breakdown on every scan",
  "Complete upgrade plan with all recommendations",
  "Progress history & level-up comparisons",
  "Priority processing",
];

export default function PaywallPage() {
  const [checkoutStarted, setCheckoutStarted] = useState(false);

  useEffect(() => {
    track("paywall_viewed");
  }, []);

  function handleCheckout() {
    track("checkout_started", { price: "9.99", interval: "month" });
    setCheckoutStarted(true);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-5 py-10">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">Aura Pro</h1>
        <p className="mt-2 text-muted">Unlock your full progression system.</p>
      </div>

      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold">$9.99</span>
          <span className="text-muted">/ month</span>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-success">✓</span>
              {f}
            </li>
          ))}
        </ul>
        <p className="text-center text-xs text-muted">Cancel anytime. No hidden fees.</p>
      </Card>

      {!checkoutStarted ? (
        <Button size="lg" onClick={handleCheckout}>
          Start Aura Pro — $9.99/mo
        </Button>
      ) : (
        <Card className="text-center text-sm text-muted">
          This is a Phase 3 prototype placeholder. In the pilot, this button opens a real Stripe Payment Link so we
          can measure actual purchase behavior, not just stated intent.
        </Card>
      )}

      <p className="text-center text-xs text-muted">
        Pricing shown is a hypothesis being tested with real users, not a final price.
      </p>
    </div>
  );
}
