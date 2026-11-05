// The CLI tab writes the app's part of a recipe as a `# In your app: <note>` comment. The runner
// swaps each note for the call to the stand-in app it stands for, using the script's variables.
const appUrl = "http://localhost:3000";

function postToApp(appPath, jsonBodyShell = "'{}'") {
  return `curl -fsS -o /dev/null -X POST ${appUrl}${appPath} -H 'content-type: application/json' -d ${jsonBodyShell}`;
}

const appStepsByNote = {
  "request a password reset for rahim@example.test": postToApp(
    "/forgot-password",
    `'{"email":"rahim@example.test"}'`,
  ),
  "open the first link and choose a new password": postToApp(
    "/reset-password",
    `"$(jq -c '{link: .links[0], password: "a-new-password"}' <<<"$links")"`,
  ),
  "sign up as user@example.test": postToApp(
    "/register",
    `'{"email":"user@example.test"}'`,
  ),
  "enter the code": postToApp(
    "/verify",
    `"$(jq -c '{code: .code}' <<<"$otp")"`,
  ),
  "invite sam@example.test": postToApp(
    "/invitations",
    `'{"email":"sam@example.test"}'`,
  ),
  "email the ticket update to rahim@example.test": postToApp(
    "/tickets/318/notify",
  ),
  "text the order update to +8801700000000": postToApp("/orders/42/notify"),
  "fail order 42; your app posts to http://127.0.0.1:8025/catch/slack":
    postToApp("/orders/42/fail"),
  "start a login for +8801700000000": postToApp(
    "/login",
    `'{"phone":"+8801700000000"}'`,
  ),
  "enter the old code; your app should refuse it": postToApp(
    "/login/verify",
    `"$(jq -c '{code: .code}' <<<"$verification")"`,
  ),
};

/** The CLI script with every `# In your app:` note replaced by its call; an unknown note fails. */
export function replaceAppNotes(cliScript) {
  return cliScript.replace(/^# In your app: (.+)$/gm, (_noteLine, appNote) => {
    const appStep = appStepsByNote[appNote];
    if (appStep === undefined) {
      throw new Error(`No stand-in call for the CLI note "${appNote}"`);
    }

    return appStep;
  });
}
