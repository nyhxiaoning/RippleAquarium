import { describe, expect, it } from "vitest";
import { setLanguage, t } from "../src/i18n.js";
import { WEATHER_KINDS } from "../src/weather/types.js";

describe("manual weather controls", () => {
  it("exposes the four supported modes in button order", () => {
    expect(WEATHER_KINDS).toEqual(["clear", "rain", "snow", "cloudy"]);
  });

  it("provides labels for each weather button", () => {
    setLanguage("zh");
    expect(t("weather_clear")).toBe("晴天");
    expect(t("weather_rain")).toBe("雨天");
    expect(t("weather_snow")).toBe("雪天");
    expect(t("weather_cloudy")).toBe("阴天");
  });
});
