"use server";

import { revalidatePath } from "next/cache";

import { redeemFromCreditPool, RedemptionError } from "@/lib/enterprise/credit";
import { ActionError, authActionClient } from "@/lib/safe-action";
import { redeemSchema } from "@/lib/validation/enterprise";

/** Learner-scoped (members redeem for themselves; org membership is checked inside). */
export const redeemFromPool = authActionClient
  .inputSchema(redeemSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      const result = await redeemFromCreditPool({
        licenseId: parsedInput.licenseId,
        userId: ctx.session.user.id,
        itemType: parsedInput.itemType,
        courseId: parsedInput.courseId,
        projectId: parsedInput.projectId,
      });
      revalidatePath("/learn/org");
      revalidatePath("/learn");
      return result;
    } catch (err) {
      if (err instanceof RedemptionError) throw new ActionError(err.message);
      throw err;
    }
  });
