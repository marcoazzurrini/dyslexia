import { getAccount } from "@dyslexia/auth/client";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { signOut } from "../lib/session";
import { useBottomInset } from "../player/inset";
import type { Account } from "../screens/profile-screen";
import { ProfileScreen } from "../screens/profile-screen";

const Profile = () => {
  const [account, setAccount] = useState<Account | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const found = await getAccount();
        if (current) {
          setAccount(found);
        }
      } catch (error) {
        if (current) {
          setLoadError(
            error instanceof Error ? error.message : "The request failed."
          );
        }
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, []);

  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch {
      // Still signed in; the button can be pressed again.
      setBusy(false);
    }
  };

  return (
    <ProfileScreen
      account={account}
      error={loadError || undefined}
      busy={busy}
      bottomInset={useBottomInset()}
      onSignOut={() => {
        void leave();
      }}
    />
  );
};

export const Route = createFileRoute("/profile")({ component: Profile });
