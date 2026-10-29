// Programul săptămânal peste schimbarea orei (Europe/Chisinau). Rulează cu: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDepartures } from "./schedule";

const iso = (ds: Date[]) => ds.map((d) => d.toISOString());

test("joi 07:00 rămâne 07:00 la Chișinău și după trecerea la ora de iarnă (25.10.2026)", () => {
  assert.deepEqual(iso(nextDepartures(4, "07:00", 3, new Date("2026-10-20T00:00:00Z"))), [
    "2026-10-22T04:00:00.000Z", // vară, UTC+3
    "2026-10-29T05:00:00.000Z", // iarnă, UTC+2
    "2026-11-05T05:00:00.000Z",
  ]);
});

test("duminică 12:00 rămâne 12:00 și după trecerea la ora de vară (28.03.2027)", () => {
  assert.deepEqual(iso(nextDepartures(0, "12:00", 3, new Date("2027-03-20T00:00:00Z"))), [
    "2027-03-21T10:00:00.000Z", // iarnă, UTC+2
    "2027-03-28T09:00:00.000Z", // vară, UTC+3
    "2027-04-04T09:00:00.000Z",
  ]);
});

test("peste sfârșit de lună și de an", () => {
  assert.deepEqual(iso(nextDepartures(4, "08:30", 2, new Date("2026-12-25T00:00:00Z"))), ["2026-12-31T06:30:00.000Z", "2027-01-07T06:30:00.000Z"]);
});
