import { query } from "./_generated/server";

export const listSuppressions = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("suppressions").collect();
  },
});
