import { createEvent, updateEvent, deleteEvent, findFreeSlots } from './google-calendar.js';
import { sendEmail, createDraft, markAsRead, archiveEmails, searchEmails, getEmailBody } from './gmail.js';
import { createReminder, dismissReminder } from './reminders.js';
import { searchFiles, listRecentFiles, createGoogleDoc, createGoogleSheet, createMeetLink } from './google-drive.js';
import { saveFact } from './memory.js';
import { webSearch, getWeather, getNews, calculate } from './skills.js';
import { logExpense, getMonthlyExpenses, getCategoryTotal } from './expenses.js';

// ─────────────────────────────────────────────────────
// Action Executor
//
// Takes parsed action objects from action-parser.js and
// executes them against the real Google APIs and local DB.
// Returns a result string that gets appended to the AI
// response so the user sees confirmation.
//
// Called by message-router.js after the AI generates a
// response containing [ACTION:...] tags.
// ─────────────────────────────────────────────────────

/**
 * Execute a single action and return a human-readable result.
 */
export async function executeAction(actionType, params, subscriber, context = {}) {
  try {
    switch (actionType) {
      // ── Calendar Actions ──
      case 'create_event':
        return await handleCreateEvent(params, subscriber);
      case 'update_event':
        return await handleUpdateEvent(params, subscriber);
      case 'delete_event':
        return await handleDeleteEvent(params, subscriber);
      case 'find_free_slots':
        return await handleFindFreeSlots(params, subscriber);

      // ── Email Actions ──
      case 'send_email':
        return await handleSendEmail(params, subscriber);
      case 'create_draft':
        return await handleCreateDraft(params, subscriber);
      case 'mark_read':
        return await handleMarkRead(params, subscriber);
      case 'archive_email':
        return await handleArchiveEmail(params, subscriber);
      case 'search_email':
        return await handleSearchEmail(params, subscriber);
      case 'read_email':
        return await handleReadEmail(params, subscriber);

      // ── Reminder Actions ──
      case 'create_reminder':
        return await handleCreateReminder(params, subscriber, context);
      case 'dismiss_reminder':
        return await handleDismissReminder(params);

      // ── Google Drive / Docs / Sheets Actions ──
      case 'search_drive':
        return await handleSearchDrive(params, subscriber);
      case 'recent_files':
        return await handleRecentFiles(params, subscriber);
      case 'create_doc':
        return await handleCreateDoc(params, subscriber);
      case 'create_sheet':
        return await handleCreateSheet(params, subscriber);

      // ── Google Meet ──
      case 'create_meet':
        return await handleCreateMeet(params, subscriber);

      // ── Skills (web search, weather, news, calc) ──
      case 'web_search':
        return await webSearch(params.query, parseInt(params.count, 10) || 3);
      case 'weather':
        return await getWeather(params.location);
      case 'news':
        return await getNews(params.topic, parseInt(params.count, 10) || 5);
      case 'calculate':
        return await calculate(params.expression);

      // ── Expense Tracking ──
      case 'log_expense':
        return await handleLogExpense(params, subscriber);
      case 'expense_summary':
        return await handleExpenseSummary(params, subscriber);

      // ── Memory (silent — user never sees these) ──
      case 'memory_save':
        return await handleMemorySave(params, subscriber);

      default:
        console.warn(`[ACTION] Unknown action type: ${actionType}`);
        return { success: false, result: '' };
    }
  } catch (err) {
    console.error(`[ACTION] Error executing ${actionType}: ${err.message}`);
    return { success: false, result: `(Action failed: ${err.message})` };
  }
}

/**
 * Execute all actions from a parsed list and return combined results.
 */
export async function executeAllActions(actions, subscriber, context = {}) {
  const results = [];

  for (const { action, params } of actions) {
    const result = await executeAction(action, params, subscriber, context);
    results.push({ action, ...result });
  }

  return {
    results,
    allSucceeded: results.every((r) => r.success),
  };
}

// ─── Calendar Handlers ───

async function handleCreateEvent(params, subscriber) {
  const { title, start, end, location, description, allDay } = params;

  if (!title || !start) {
    return { success: false, result: '(Could not create event — missing title or start time)' };
  }

  const result = await createEvent(subscriber, {
    title,
    startTime: start,
    endTime: end || null,
    location: location || '',
    description: description || '',
    allDay: allDay === 'true',
  });

  if (result.success) {
    return { success: true, result: '' };
  }
  return { success: false, result: `(Could not create event: ${result.error})` };
}

async function handleUpdateEvent(params, subscriber) {
  const { eventId, title, start, end, location, description } = params;

  if (!eventId) {
    return { success: false, result: '(Could not update — missing event ID)' };
  }

  const updates = {};
  if (title) updates.title = title;
  if (start) updates.startTime = start;
  if (end) updates.endTime = end;
  if (location) updates.location = location;
  if (description) updates.description = description;

  const result = await updateEvent(subscriber, eventId, updates);

  if (result.success) {
    return { success: true, result: '' };
  }
  return { success: false, result: `(Could not update event: ${result.error})` };
}

async function handleDeleteEvent(params, subscriber) {
  const { eventId } = params;

  if (!eventId) {
    return { success: false, result: '(Could not delete — missing event ID)' };
  }

  const result = await deleteEvent(subscriber, eventId);

  if (result.success) {
    return { success: true, result: '' };
  }
  return { success: false, result: `(Could not delete event: ${result.error})` };
}

async function handleFindFreeSlots(params, subscriber) {
  const hours = parseInt(params.hours, 10) || 8;
  const { slots, error } = await findFreeSlots(subscriber, hours);

  if (error) {
    return { success: false, result: `(Could not check calendar: ${error})` };
  }

  if (slots.length === 0) {
    return { success: true, result: '(No free slots found in that window)' };
  }

  const tz = subscriber.profileData?.timezone || 'America/New_York';
  const formatted = slots.map((s) => {
    const startStr = new Date(s.start).toLocaleTimeString('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const endStr = new Date(s.end).toLocaleTimeString('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    });
    return `${startStr} — ${endStr} (${s.durationMinutes} min)`;
  });

  return { success: true, result: `Free slots:\n${formatted.join('\n')}` };
}

// ─── Email Handlers ───

async function handleSendEmail(params, subscriber) {
  const { to, subject, body, replyToMessageId, threadId } = params;

  if (!to || !subject || !body) {
    return { success: false, result: '(Could not send — missing to, subject, or body)' };
  }

  // Only pass threadId/replyToMessageId if they look like real Gmail IDs (hex strings)
  const isValidGmailId = (id) => id && /^[0-9a-f]{16}$/i.test(id);

  const result = await sendEmail(subscriber, {
    to, subject, body,
    replyToMessageId: isValidGmailId(replyToMessageId) ? replyToMessageId : undefined,
    threadId: isValidGmailId(threadId) ? threadId : undefined,
  });

  if (result.success) return { success: true, result: '' };
  return { success: false, result: `(Could not send email: ${result.error})` };
}

async function handleCreateDraft(params, subscriber) {
  const { to, subject, body } = params;

  if (!to || !subject || !body) {
    return { success: false, result: '(Could not create draft — missing to, subject, or body)' };
  }

  const result = await createDraft(subscriber, { to, subject, body });

  if (result.success) return { success: true, result: '' };
  return { success: false, result: `(Could not create draft: ${result.error})` };
}

async function handleMarkRead(params, subscriber) {
  const { ids } = params;
  if (!ids) return { success: false, result: '(No email IDs to mark as read)' };

  const messageIds = ids.split(',').map((id) => id.trim());
  const result = await markAsRead(subscriber, messageIds);

  if (result.success) return { success: true, result: '' };
  return { success: false, result: `(Could not mark as read: ${result.error})` };
}

async function handleArchiveEmail(params, subscriber) {
  const { ids } = params;
  if (!ids) return { success: false, result: '(No email IDs to archive)' };

  const messageIds = ids.split(',').map((id) => id.trim());
  const result = await archiveEmails(subscriber, messageIds);

  if (result.success) return { success: true, result: '' };
  return { success: false, result: `(Could not archive: ${result.error})` };
}

async function handleSearchEmail(params, subscriber) {
  const { query } = params;
  if (!query) return { success: false, result: '(No search query provided)' };

  const { emails, error } = await searchEmails(subscriber, query, 5);

  if (error) return { success: false, result: `(Search failed: ${error})` };
  if (emails.length === 0) return { success: true, result: '(No emails found matching that search)' };

  const lines = emails.map((e) => `- ${e.from}: "${e.subject}" (${e.relativeTime})`);
  return { success: true, result: `Found:\n${lines.join('\n')}` };
}

async function handleReadEmail(params, subscriber) {
  const { id } = params;
  if (!id) return { success: false, result: '(No email ID provided)' };

  const { body, subject, from, error } = await getEmailBody(subscriber, id);

  if (error) return { success: false, result: `(Could not read email: ${error})` };
  return { success: true, result: `Email from ${from}\nSubject: ${subject}\n\n${body}` };
}

// ─── Reminder Handlers ───

async function handleCreateReminder(params, subscriber, context) {
  const { title, due } = params;

  if (!title || !due) {
    return { success: false, result: '(Could not create reminder — missing title or due time)' };
  }

  await createReminder(subscriber.id, {
    title,
    dueAt: new Date(due),
    agentId: context.agentId || null,
  });

  return { success: true, result: '' };
}

async function handleDismissReminder(params) {
  const { id } = params;
  if (!id) return { success: false, result: '(No reminder ID provided)' };
  await dismissReminder(id);
  return { success: true, result: '' };
}

// ─── Google Drive Handlers ───

async function handleSearchDrive(params, subscriber) {
  const { query } = params;
  if (!query) return { success: false, result: '(No search query provided)' };

  const { files, error } = await searchFiles(subscriber, query, 5);

  if (error) return { success: false, result: `(Drive search failed: ${error})` };
  if (files.length === 0) return { success: true, result: '(No files found matching that search)' };

  const lines = files.map((f) => `- ${f.name} (${f.type}) — ${f.link}`);
  return { success: true, result: `Found files:\n${lines.join('\n')}` };
}

async function handleRecentFiles(params, subscriber) {
  const count = parseInt(params.count, 10) || 5;
  const { files, error } = await listRecentFiles(subscriber, count);

  if (error) return { success: false, result: `(Could not list files: ${error})` };
  if (files.length === 0) return { success: true, result: '(No recent files found)' };

  const lines = files.map((f) => `- ${f.name} (${f.type}, ${f.relativeTime}) — ${f.link}`);
  return { success: true, result: `Recent files:\n${lines.join('\n')}` };
}

async function handleCreateDoc(params, subscriber) {
  const { title, content } = params;
  if (!title) return { success: false, result: '(Could not create doc — missing title)' };

  const result = await createGoogleDoc(subscriber, title, content || '');

  if (result.success) {
    return { success: true, result: result.link };
  }
  return { success: false, result: `(Could not create doc: ${result.error})` };
}

async function handleCreateSheet(params, subscriber) {
  const { title } = params;
  if (!title) return { success: false, result: '(Could not create sheet — missing title)' };

  const result = await createGoogleSheet(subscriber, title);

  if (result.success) {
    return { success: true, result: result.link };
  }
  return { success: false, result: `(Could not create sheet: ${result.error})` };
}

// ─── Google Meet Handler ───

async function handleCreateMeet(params, subscriber) {
  const { title, start, end, attendees } = params;
  if (!title || !start) {
    return { success: false, result: '(Could not create meeting — missing title or start time)' };
  }

  const attendeeList = attendees ? attendees.split(',').map((e) => e.trim()) : [];
  const result = await createMeetLink(subscriber, title, start, end || null, attendeeList);

  if (result.success) {
    return { success: true, result: result.meetLink };
  }
  return { success: false, result: `(Could not create meeting: ${result.error})` };
}

// ─── Expense Handlers ───

async function handleLogExpense(params, subscriber) {
  const { amount, category, description } = params;

  if (!amount) {
    return { success: false, result: '(Could not log expense — missing amount)' };
  }

  const result = await logExpense(subscriber.id, {
    amount,
    category: category || 'other',
    description: description || null,
  });

  if (result.success) {
    return { success: true, result: '' };
  }
  return { success: false, result: `(Could not log expense: ${result.error})` };
}

async function handleExpenseSummary(params, subscriber) {
  const category = params.category;

  if (category) {
    // Category-specific total
    const { total, count } = await getCategoryTotal(subscriber.id, category);
    const label = category.charAt(0).toUpperCase() + category.slice(1);
    return {
      success: true,
      result: count > 0
        ? `${label} this month: $${total.toFixed(2)} (${count} expense${count > 1 ? 's' : ''})`
        : `No ${label.toLowerCase()} expenses logged this month`,
    };
  }

  // Full monthly summary
  const { total, byCategory, count } = await getMonthlyExpenses(subscriber.id);

  if (count === 0) {
    return { success: true, result: 'No expenses logged this month yet' };
  }

  let summary = `This month: $${total.toFixed(2)} across ${count} expense${count > 1 ? 's' : ''}\n`;
  const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
  for (const [cat, data] of sorted) {
    const label = cat.charAt(0).toUpperCase() + cat.slice(1);
    summary += `${label}: $${data.total.toFixed(2)} (${data.count}x)\n`;
  }

  return { success: true, result: summary.trim() };
}

// ─── Memory Handler (silent) ───

async function handleMemorySave(params, subscriber) {
  const { category, fact } = params;

  if (!category || !fact) {
    console.warn('[ACTION] memory_save missing category or fact');
    return { success: false, result: '' };
  }

  const result = await saveFact(subscriber.id, { category, fact });

  // Always return empty result — memory ops are invisible to the user
  return { success: result.saved, result: '' };
}
