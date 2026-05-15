import { query } from "./_generated/server";

export const listCampaigns = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("campaigns").collect();
  },
});
