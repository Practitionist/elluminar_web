"use server";

import { z } from "zod";

import { db } from "@/lib/db";
import { authActionClient } from "@/lib/safe-action";

export const markAllNotificationsRead = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    await db.notification.updateMany({
      where: { userId: ctx.session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });
