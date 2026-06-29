"use server";

import { hexclaveServerApp } from "@/hexclave";
import { formSchema } from "./validators";
import { type } from "arktype";
import {
  AccessByIdPublic,
  AccessByIdPassword,
  AccessByIdSecret,
  type AccessById,
  MUTATIONS,
} from "@/db/queries";
import { Result, err, ok } from "neverthrow";
import { getUntis } from "@/lib/untis";

export async function getClasses(school: string, domain: string) {
  await hexclaveServerApp.getUser({ or: "redirect" });
  const untis = getUntis({
    url: domain,
    school,
    timezone: "Europe/Berlin",
    auth: {
      type: "public",
    },
  });
  const session = await untis.login();
  if (session.isErr()) return;
  const classes = await untis.getClassesForCurrentSchoolYear(session.value);
  if (classes.isErr()) return;
  await untis.logout(session.value);
  return classes.value;
}

export async function createAccess(values: typeof formSchema.infer) {
  await hexclaveServerApp.getUser({ or: "redirect" });
  const validatedValues = formSchema(values);
  if (validatedValues instanceof type.errors)
    return { error: validatedValues.summary };

  const validatedForDb = validate(validatedValues);
  if (validatedForDb.isErr()) return { error: validatedForDb.error };
  const uuid = crypto.randomUUID();
  await Promise.all([
    addIdToUser(uuid),
    MUTATIONS.addAccess(validatedForDb.value, uuid),
  ]);
  return;
}

function validate(values: typeof formSchema.infer): Result<AccessById, string> {
  const validatedAsPublic = AccessByIdPublic(values);
  if (!(validatedAsPublic instanceof type.errors)) return ok(validatedAsPublic);
  const validatedAsPassword = AccessByIdPassword(values);
  if (!(validatedAsPassword instanceof type.errors))
    return ok(validatedAsPassword);
  const validatedAsSecret = AccessByIdSecret(values);
  if (!(validatedAsSecret instanceof type.errors)) return ok(validatedAsSecret);
  return err("Unknown auth type");
}

async function addIdToUser(uuid: string) {
  const user = await hexclaveServerApp.getUser({ or: "redirect" });
  await user.update({
    serverMetadata: {
      accesses: [...(user.serverMetadata?.accesses ?? []), uuid],
    },
  });
}
