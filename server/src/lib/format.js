// Formatting used in SMS messages.
export function formatBirr(santim) {
  return (santim / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDateTime(date) {
  return new Date(date).toLocaleString('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
