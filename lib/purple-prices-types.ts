export type CampaignMessage = {
  body: string;
  mailingAddress: string;
  previewText: string;
  subject: string;
};

export type SavedTemplate = {
  id: string;
  name: string;
  updatedAt: string;
  message: CampaignMessage;
};
