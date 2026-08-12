const CANNED_RESPONSES = [
  {
    id: 'cr1',
    title: 'Ticket Received Confirmation',
    category: 'General',
    body: "Thanks for reaching out — we've received your ticket and it's now in our queue. We'll follow up as soon as we begin investigating.",
  },
  {
    id: 'cr2',
    title: 'Password Reset Instructions',
    category: 'Account & Access',
    body: 'To reset your password: go to the login page, select "Forgot password?", and follow the emailed link. If you don\'t receive the email within 10 minutes, check your spam folder before opening a follow-up ticket.',
  },
  {
    id: 'cr3',
    title: 'MFA Reset Instructions',
    category: 'Account & Access',
    body: "We've cleared your existing MFA enrollment. Please log in and follow the prompts to re-enroll your authenticator app. If you no longer have access to your original device, let us know so we can verify your identity before resetting.",
  },
  {
    id: 'cr4',
    title: 'Request for Additional Information',
    category: 'General',
    body: 'To keep investigating this, could you send over a few more details: the exact time the issue started, any error messages you saw, and whether it affects one user or several? That will help us narrow this down quickly.',
  },
  {
    id: 'cr5',
    title: 'VPN Troubleshooting Steps',
    category: 'Network & Systems',
    body: "Before we dig deeper, could you try: 1) disconnecting and reconnecting the VPN client, 2) confirming you're on a stable network connection, and 3) restarting the VPN client if step 1 doesn't help? Let us know if the issue persists after that.",
  },
  {
    id: 'cr6',
    title: 'Escalation Notice',
    category: 'General',
    body: "We've escalated this ticket to our team leader for closer attention given its priority/impact. You'll continue to receive updates here as we make progress.",
  },
  {
    id: 'cr7',
    title: 'Scheduled Maintenance Notice',
    category: 'General',
    body: 'This is a heads-up that the affected system is scheduled for maintenance shortly, which may cause brief interruptions. We will confirm once maintenance is complete and the issue has been re-verified.',
  },
  {
    id: 'cr8',
    title: 'Awaiting Client Response Reminder',
    category: 'General',
    body: "Just following up — we're still waiting on the information requested above to continue troubleshooting. Feel free to reply here whenever you have it, and we'll pick this back up right away.",
  },
  {
    id: 'cr9',
    title: 'Resolution Confirmation',
    category: 'General',
    body: "This issue has been resolved on our end. Could you confirm everything looks correct on your side as well? We'll mark this as Resolved and it will automatically close if we don't hear back within a few days.",
  },
  {
    id: 'cr10',
    title: 'Closing Message',
    category: 'General',
    body: "Since we haven't heard back and the fix has been holding, we're closing this ticket. If the issue resurfaces, just reopen it or reference this ticket number in a new one — no need to start from scratch.",
  },
];

function buildCannedResponses() {
  const now = new Date();
  return CANNED_RESPONSES.map((cr) => ({ ...cr, createdAt: now, updatedAt: now }));
}

module.exports = { buildCannedResponses };
