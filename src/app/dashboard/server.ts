"use server";

import { MUTATIONS } from "@/db/queries";
import { hexclaveServerApp } from "@/hexclave";

export async function deleteAccountAction() {
  const user = await hexclaveServerApp.getUser({ or: "redirect" });
  const accesses = (user.serverMetadata?.accesses ?? []) as string[];
  const results = await Promise.all(
    accesses.map((access) => MUTATIONS.deleteAccess(access)),
  );
  const failed = results.filter((result) => result.isErr());
  if (failed.length > 0) {
    throw new Error(`Failed to delete ${failed.length} access record(s)`);
  }
  await user.delete();
}
