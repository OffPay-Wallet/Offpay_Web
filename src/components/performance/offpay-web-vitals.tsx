"use client";

import { useReportWebVitals } from "next/web-vitals";

import { debugLog } from "@/lib/offpay/debug";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const reportWebVitals: ReportWebVitalsCallback = (metric) => {
  debugLog("perf.web_vital", {
    delta: Number(metric.delta.toFixed(2)),
    id: metric.id,
    name: metric.name,
    navigationType: metric.navigationType,
    rating: metric.rating,
    value: Number(metric.value.toFixed(2)),
  });
};

export function OffpayWebVitals() {
  useReportWebVitals(reportWebVitals);

  return null;
}
