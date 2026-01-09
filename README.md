# Mobile Music Calendar

This Google Apps Script project retrieves events for the Kansas City Symphony Mobile Music Box from an API and syncs them with a Google Calendar. It automatically adds new events, updates existing ones, and removes cancelled events.

## Features

- **Syncs from API**: Fetches event data from a specified JSON API endpoint.
- **Adds New Events**: Creates new Google Calendar events for new items from the API.
- **Updates Existing Events**: Checks for changes in event details (title, description, location) and updates the calendar event accordingly.
- **Deletes Old Events**: Removes events from the calendar that are no longer present in the API data.
- **Configurable**: Uses Script Properties for easy configuration of the API endpoint, calendar ID, and event duration.
- **Automated Deployment**: Includes a GitHub Action to automatically deploy the script on pushes to the `main` branch.

## Prerequisites

- A Google account.
- [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
- The [Google Apps Script Command Line Interface (clasp)](https://github.com/google/clasp) installed (`npm install -g @google/clasp`).

## Configuration

This script is configured using Google Apps Script's Script Properties.

1.  Open the Google Apps Script project.
2.  Go to **Project Settings** (the gear icon on the left).
3.  Scroll down to the **Script Properties** section and click **Add script property**.
4.  Add the following properties:

    -   **`API_ENDPOINT`**: The URL of the JSON API that provides the event data.
    -   **`CALENDAR_ID`**: The ID of the Google Calendar you want to sync events to. You can find this in the calendar's settings. For the primary calendar, you can leave this blank.
    -   **`EVENT_DURATION_MINUTES`**: The default duration for new calendar events in minutes. Defaults to `90` if not set.

## Running the Script Manually

You can run the script directly from the Google Apps Script editor:

1.  Open the project in the Apps Script editor.
2.  Select the `syncEventsToCalendar` function from the dropdown menu at the top.
3.  Click **Run**.

You can also set up a time-based trigger within Google Apps Script to run the `syncEventsToCalendar` function periodically (e.g., every day).

## Deployment

### Manual Deployment

You can deploy the script from your local machine using `clasp`.

1.  Clone the repository.
2.  Run `npm install` to install dependencies.
3.  Log in to `clasp` by running `npx clasp login`.
4.  Push the code to your Google Apps Script project:
    ```bash
    npm run deploy
    ```

### Automated Deployment with GitHub Actions

This project includes a GitHub Action workflow (`.github/workflows/deploy.yml`) that automatically deploys the script to Google Apps Script when changes are pushed to the `main` branch.

To enable this, you need to add a secret to your GitHub repository:

1.  First, generate a `.clasprc.json` file by running `npx clasp login` locally. This file contains your authentication credentials. It is usually saved in your home directory (`~/.clasprc.json`).
2.  Open the `.clasprc.json` file and copy its entire content.
3.  Go to your GitHub repository's **Settings** tab.
4.  Navigate to **Secrets and variables** > **Actions** and click **New repository secret**.
5.  Name the secret `CLASPRC_JSON`.
6.  Paste the contents of your `.clasprc.json` file into the "Value" field.
7.  Save the secret.

Now, any push to the `main` branch will trigger the GitHub Action and deploy the latest version of the script.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
