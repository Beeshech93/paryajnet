import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { toActionError, type ActionResult } from "@/lib/types";

/** Run a mutation, translate AppErrors for the UI and refresh cached pages. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}
