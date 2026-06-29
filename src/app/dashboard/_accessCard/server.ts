import { MUTATIONS } from "@/db/queries";
import { hexclaveServerApp } from "@/hexclave";
import { ok, err, type Result } from "neverthrow";

export async function removeAccess(id: string) {
  const userResult = await removeIdFromUser(id);
  if (userResult.isErr())
    return console.error("Error removing user", userResult.error);

  const dbResult = await MUTATIONS.deleteAccess(id);
  if (dbResult.isErr()) console.error("Error deleting access", dbResult.error);
}

async function removeIdFromUser(uuid: string): Promise<Result<void, string>> {
  const user = await hexclaveServerApp.getUser({ or: "redirect" });
  if (!((user.serverMetadata.accesses ?? []) as string[]).includes(uuid))
    return err("Permission denied");
  await user.update({
    serverMetadata: {
      accesses: ((user.serverMetadata?.accesses ?? []) as string[]).filter(
        (id) => id !== uuid,
      ),
    },
  });
  return ok();
}
