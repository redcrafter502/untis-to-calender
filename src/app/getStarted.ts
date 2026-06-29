"use server";
import { redirect } from "next/navigation";
import { hexclaveServerApp } from "@/hexclave";

export async function getStarted() {
  await hexclaveServerApp.getUser({ or: "redirect" });
  redirect("/dashboard");
}
