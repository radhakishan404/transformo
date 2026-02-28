export interface MonetizationSettings {
  readonly feedbackUrl: string;
}

const settings: MonetizationSettings = (() => {
  const feedbackUrl = (import.meta.env.VITE_FEEDBACK_URL ?? '').trim();

  return {
    feedbackUrl,
  };
})();

export function getMonetizationSettings(): MonetizationSettings {
  return settings;
}
