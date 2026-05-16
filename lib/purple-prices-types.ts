export type CampaignMessage = {
  body: string;
  mailingAddress: string;
  previewText: string;
  subject: string;
};

export type CampaignContact = {
  email: string;
  name: string;
};

export type CampaignDraft = {
  campaignName: string;
  draftMessageName: string;
  messageSubject: string;
  messagePreviewText: string;
  messageBody: string;
  messageMailingAddress: string;
  csvContacts: CampaignContact[];
  typedContacts: CampaignContact[];
  pasteText: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "ssl" | "starttls";
  smtpUsername: string;
  fromName: string;
  dailyLimit: number;
  perSecond: number;
  spacingMode: "rate" | "daily";
  updatedAt?: string;
};

export type SavedTemplate = {
  id: string;
  name: string;
  updatedAt: string;
  message: CampaignMessage;
};
