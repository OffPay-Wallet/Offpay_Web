import { describe, expect, it } from "vitest";

import {
  getGreetingForHour,
  getHourInTimeZone,
  getLocalGreeting,
} from "../../../src/lib/offpay/local-greeting";

describe("local greeting", () => {
  it("maps local hours to the expected greeting", () => {
    expect(getGreetingForHour(4)).toBe("Good night");
    expect(getGreetingForHour(5)).toBe("Good morning");
    expect(getGreetingForHour(11)).toBe("Good morning");
    expect(getGreetingForHour(12)).toBe("Good afternoon");
    expect(getGreetingForHour(16)).toBe("Good afternoon");
    expect(getGreetingForHour(17)).toBe("Good evening");
    expect(getGreetingForHour(21)).toBe("Good evening");
    expect(getGreetingForHour(22)).toBe("Good night");
  });

  it("uses the supplied IANA timezone when resolving the local hour", () => {
    const date = new Date("2026-07-03T12:00:00.000Z");

    expect(getHourInTimeZone(date, "Asia/Kolkata")).toBe(17);
    expect(getHourInTimeZone(date, "America/Los_Angeles")).toBe(5);
  });

  it("returns a location-sensitive greeting from the supplied timezone", () => {
    const date = new Date("2026-07-03T12:00:00.000Z");

    expect(getLocalGreeting(date, "Asia/Kolkata")).toBe("Good evening");
    expect(getLocalGreeting(date, "America/Los_Angeles")).toBe("Good morning");
  });
});
