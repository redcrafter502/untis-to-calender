"use server";
import { redirect } from "next/navigation";
import { hexclaveServerApp } from "@/stack";

export async function getStarted() {
  await hexclaveServerApp.getUser({ or: "redirect" });
  redirect("/dashboard");
}
