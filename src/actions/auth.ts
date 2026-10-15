"use server";
import { getAdmin } from "@/lib/auth";

// Вызывается со страницы входа сразу после signInWithPassword
export async function checkAdmin(): Promise<boolean> {
  return !!(await getAdmin());
}
