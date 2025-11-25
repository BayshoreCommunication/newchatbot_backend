const NAME_PATTERN = /(?:my name is|i'm|i am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;
const PHONE_PATTERN = /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/;
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;

const UNKNOWN_QUESTION_INDICATORS = [
  "I don't have that specific",
  "I don't have that detail",
  "don't have that information",
  "Our attorney can provide",
  "Attorney Carter can give you",
  "Great question for our legal team"
];

export interface LeadInfo {
  name?: string;
  phone?: string;
  email?: string;
  hasLead: boolean;
}

export function detectLeadInfo(message: string): LeadInfo {
  const result: LeadInfo = { hasLead: false };

  const nameMatch = message.match(NAME_PATTERN);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
    result.hasLead = true;
  }

  const phoneMatch = message.match(PHONE_PATTERN);
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/[-.\s]/g, '');
    result.hasLead = true;
  }

  const emailMatch = message.match(EMAIL_PATTERN);
  if (emailMatch) {
    result.email = emailMatch[0];
    result.hasLead = true;
  }

  return result;
}

export function isUnknownQuestion(response: string): boolean {
  const lowerResponse = response.toLowerCase();
  return UNKNOWN_QUESTION_INDICATORS.some(indicator =>
    lowerResponse.includes(indicator.toLowerCase())
  );
}

export function extractLeadFromConversation(messages: any[]): LeadInfo {
  const result: LeadInfo = { hasLead: false };

  for (const msg of messages) {
    if (msg.role !== 'user') continue;

    const content = Array.isArray(msg.content)
      ? msg.content.map((c: any) => c.text?.value || '').join(' ')
      : msg.content;

    const leadInfo = detectLeadInfo(content);

    if (leadInfo.name && !result.name) result.name = leadInfo.name;
    if (leadInfo.phone && !result.phone) result.phone = leadInfo.phone;
    if (leadInfo.email && !result.email) result.email = leadInfo.email;

    if (leadInfo.hasLead) result.hasLead = true;
  }

  return result;
}
