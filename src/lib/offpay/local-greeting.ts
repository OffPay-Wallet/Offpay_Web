export type LocalGreeting = "Good morning" | "Good afternoon" | "Good evening" | "Good night";

export function getGreetingForHour(hour: number): LocalGreeting {
  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "Good evening";
  }

  return "Good night";
}

export function getCurrentTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export function getHourInTimeZone(date: Date, timeZone = getCurrentTimeZone()): number {
  if (!timeZone) {
    return date.getHours();
  }

  try {
    const hourPart = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone,
    })
      .formatToParts(date)
      .find((part) => part.type === "hour");
    const hour = Number(hourPart?.value);

    return Number.isInteger(hour) ? hour : date.getHours();
  } catch {
    return date.getHours();
  }
}

export function getLocalGreeting(date = new Date(), timeZone = getCurrentTimeZone()): LocalGreeting {
  return getGreetingForHour(getHourInTimeZone(date, timeZone));
}
