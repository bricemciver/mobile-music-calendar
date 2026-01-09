const HTTP_OK = 200;

// Type definitions for the event data
interface EventData {
  events: Event[];
}

interface Event {
  location: string;
  date: string;
  address?: string;
  sponsor?: string;
  notes?: string;
  alert?: string;
}

/**
 * Gets configuration from Script Properties
 */
const getConfig = (): {
  apiEndpoint: string;
  calendarId: string;
  eventDurationMinutes: number;
} => {
  const scriptProperties = PropertiesService.getScriptProperties();

  return {
    apiEndpoint: scriptProperties.getProperty("API_ENDPOINT") || "",
    calendarId: scriptProperties.getProperty("CALENDAR_ID") || "",
    eventDurationMinutes: Number.parseInt(
      scriptProperties.getProperty("EVENT_DURATION_MINUTES") || "90",
      10,
    ),
  };
};

/**
 * Fetches event data from the API endpoint
 */
const fetchEventData = (apiEndpoint: string): EventData => {
  try {
    const response = UrlFetchApp.fetch(apiEndpoint);
    const responseCode = response.getResponseCode();

    if (responseCode === HTTP_OK) {
      const responseText = response.getContentText();
      return JSON.parse(responseText) as EventData;
    } else {
      Logger.log(`API returned non-200 status code: ${responseCode}`);
    }
  } catch (error) {
    Logger.log(`Error fetching event data: ${String(error)}`);
  }
  return { events: [] } as EventData;
};

/**
 * Determines the earliest and latest dates from the event data
 */
const getDatesRange = (eventData: EventData): { earliest: Date; latest: Date } => {
  const dates = eventData.events.map((event) => new Date(event.date));

  return {
    earliest: new Date(Math.min(...dates.map((d) => d.getTime()))),
    latest: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
};

/**
 * Gets the calendar to update (primary or by ID)
 */
const getCalendar = (calendarId: string): GoogleAppsScript.Calendar.Calendar => {
  return calendarId
    ? CalendarApp.getCalendarById(calendarId)
    : CalendarApp.getDefaultCalendar();
};

/**
 * Gets existing events from the calendar within the specified date range
 */
const getExistingEvents = (
  calendar: GoogleAppsScript.Calendar.Calendar,
  startDate: Date,
  endDate: Date,
): GoogleAppsScript.Calendar.CalendarEvent[] => {
  // Add one day to end date to ensure we capture all events
  const endDatePlusDay = new Date(endDate);
  endDatePlusDay.setDate(endDatePlusDay.getDate() + 1);

  return calendar.getEvents(startDate, endDatePlusDay);
};

/**
 * Creates a map of existing calendar events for quick lookup.
 */
const buildExistingEventsMap = (
  existingEvents: GoogleAppsScript.Calendar.CalendarEvent[],
): Map<string, GoogleAppsScript.Calendar.CalendarEvent> => {
  const existingEventsMap = new Map<
    string,
    GoogleAppsScript.Calendar.CalendarEvent
  >();
  for (const event of existingEvents) {
    const eventId = createEventId(
      event.getTitle(),
      new Date(Date.parse(event.getStartTime().toISOString())),
    );
    existingEventsMap.set(eventId, event);
  }
  return existingEventsMap;
};

/**
 * Generates the description string for a calendar event.
 */
const createEventDescription = (apiEvent: Event): string => {
  const alertStr = apiEvent.alert ? `Alert: ${apiEvent.alert}\n` : "";
  const notesStr = apiEvent.notes ? `Notes: ${apiEvent.notes}\n` : "";
  const sponsorStr = apiEvent.sponsor ? `Sponsor: ${apiEvent.sponsor}\n` : "";
  return `${alertStr}${notesStr}${sponsorStr}`;
};

/**
 * Updates an existing calendar event if its details have changed.
 * @returns true if the event was updated, false otherwise.
 */
const updateExistingEvent = (
  existingEvent: GoogleAppsScript.Calendar.CalendarEvent,
  eventTitle: string,
  eventDescription: string,
  eventLocation: string | undefined,
): boolean => {
  if (
    existingEvent.getTitle() !== eventTitle ||
    existingEvent.getDescription() !== eventDescription ||
    existingEvent.getLocation() !== eventLocation
  ) {
    existingEvent.setTitle(eventTitle);
    existingEvent.setDescription(eventDescription);
    existingEvent.setLocation(eventLocation ?? "");
    return true;
  }
  return false;
};

/**
 * Deletes calendar events that are no longer present in the API data.
 * @returns The number of events deleted.
 */
const deleteRemovedEvents = (
  existingEvents: GoogleAppsScript.Calendar.CalendarEvent[],
  processedIds: Set<string>,
): number => {
  let deletedCount = 0;
  for (const event of existingEvents) {
    const eventId = createEventId(
      event.getTitle(),
      new Date(Date.parse(event.getStartTime().toISOString())),
    );
    if (!processedIds.has(eventId)) {
      event.deleteEvent();
      deletedCount++;
    }
  }
  return deletedCount;
};

/**
 * Process events: add new, update existing, delete removed
 */
const processEvents = (
  calendar: GoogleAppsScript.Calendar.Calendar,
  apiEvents: EventData,
  existingEvents: GoogleAppsScript.Calendar.CalendarEvent[],
  eventDurationMinutes: number,
): { added: number; updated: number; deleted: number } => {
  const stats = { added: 0, updated: 0, deleted: 0 };
  const processedIds = new Set<string>();
  const existingEventsMap = buildExistingEventsMap(existingEvents);

  for (const apiEvent of apiEvents.events) {
    const startTime = new Date(apiEvent.date);
    const eventId = createEventId(apiEvent.location, startTime);
    processedIds.add(eventId);

    const eventTitle = apiEvent.location;
    const eventDescription = createEventDescription(apiEvent);
    const eventLocation = apiEvent.address;

    const existingEvent = existingEventsMap.get(eventId);

    if (existingEvent) {
      if (
        updateExistingEvent(
          existingEvent,
          eventTitle,
          eventDescription,
          eventLocation,
        )
      ) {
        stats.updated++;
      }
    } else {
      const endTime = new Date(
        startTime.getTime() + eventDurationMinutes * 60 * 1000,
      );
      calendar.createEvent(eventTitle, startTime, endTime, {
        description: eventDescription,
        location: eventLocation,
      });
      stats.added++;
    }
  }

  stats.deleted = deleteRemovedEvents(existingEvents, processedIds);

  return stats;
};

/**
 * Creates a unique ID for an event based on title and start time
 */
const createEventId = (title: string, startTime: Date): string => {
  const dateStr = Utilities.formatDate(
    startTime,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd",
  );
  return `${title}|${dateStr}`;
};

/**
 * Main function to sync events from API to Google Calendar
 * Can be set up as a trigger to run periodically
 */
const syncEventsToCalendar = () => {
  try {
    const config = getConfig();

    if (!config.apiEndpoint) {
      Logger.log("API endpoint not configured. Please set it up.");
      return;
    }

    // Fetch events from the API
    const eventData = fetchEventData(config.apiEndpoint);
    if (!eventData || eventData.events.length === 0) {
      Logger.log("No events found or failed to fetch events");
      return;
    }

    // Get dates range from the events
    const dates = getDatesRange(eventData);

    // Get the calendar to update
    const calendar = getCalendar(config.calendarId);

    // Get existing events in the date range
    const existingEvents = getExistingEvents(
      calendar,
      dates.earliest,
      dates.latest,
    );

    // Process the events
    const stats = processEvents(
      calendar,
      eventData,
      existingEvents,
      config.eventDurationMinutes,
    );

    Logger.log(
      `Sync completed successfully. Added: ${stats.added}, Updated: ${stats.updated}, Deleted: ${stats.deleted}`,
    );
  } catch (error) {
    Logger.log(`Error syncing events: ${String(error)}`);
  }
};
