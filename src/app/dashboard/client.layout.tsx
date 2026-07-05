"use client";

import { UserButton } from "@hexclave/next";
import { TrashIcon } from "lucide-react";
import { deleteAccountAction } from "./server";
import { useRouter } from "next/navigation";
import { tryCatch } from "@/lib/try-catch";

export function UserButtonWrapper() {
  const router = useRouter();

  async function deleteAccount() {
    const confirmDelete = confirm(
      "Are you sure you want to permanently delete your account and all associated data? This action cannot be undone.",
    );
    if (!confirmDelete) return;
    const result = await tryCatch(deleteAccountAction());
    if (result.isErr()) {
      alert(result.error.message);
      return;
    }
    router.push("/");
  }

  return (
    <UserButton
      extraItems={[
        {
          text: "Delete Account",
          icon: <TrashIcon size={16} />,
          onClick: deleteAccount,
        },
      ]}
    />
  );
}
