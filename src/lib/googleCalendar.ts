import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/calendar/callback'
);

export const getGoogleAuthUrl = (tenantId: string) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get a refresh token
    prompt: 'consent',      // Force consent to ensure refresh token is provided
    scope: scopes,
    state: tenantId,        // Pass the tenant ID to identify them in the callback
  });
};

export const getGoogleTokens = async (code: string) => {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
};

export const createCalendarEvent = async (
  refreshToken: string,
  eventDetails: {
    summary: string;
    description: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
  }
) => {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: eventDetails.summary,
      description: eventDetails.description,
      start: {
        dateTime: eventDetails.startTime,
        timeZone: 'Africa/Cairo', // Default to Egypt time, or make dynamic later
      },
      end: {
        dateTime: eventDetails.endTime,
        timeZone: 'Africa/Cairo',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    },
  });

  return response.data;
};

export const deleteCalendarEvent = async (refreshToken: string, eventId: string) => {
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });

  return response.data;
};
