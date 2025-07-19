/** This file is a server that proxies a few services and serves an index with descriptions of the resources available.
 *
 *
 *
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { logger } from "hono/logger";
import { paymentMiddleware } from "x402-hono";

const app = new Hono();
const port = 4021;
app.use("*", logger());

type IndexEntry = {
  resourceUrl: string;
  resourceDescription: string;
  price: {
    amount: number;
    currency: string;
  };
};

const carReportApi = "https://paystabl-dev.replit.app/wrapped/";
const slug = "mon-beda";

app.use(
  paymentMiddleware(process.env.PAY_TO_ADDRESS as `0x${string}`, {
    "/weather": "$0.01",
    "/car-report": "$0.02",
  })
);

app.get("/", (c) => {
  const resources: IndexEntry[] = [
    {
      resourceUrl: "http://localhost:4021/weather",
      resourceDescription:
        "Returns the 7 day forecast for weather in a city. Must include city as a query parameter escaped properly to be url safe (ex: 'http://localhost:4021/weather?city=London')",
      price: {
        amount: 0.01,
        currency: "USDC",
      },
    },

    {
      resourceUrl: carReportApi + slug,
      resourceDescription:
        "Returns the car report for a given VIN number. Must include VIN number as a query parameter escaped properly to be url safe (ex: 'https://paystabl-dev.replit.app/car-report?vin=1234567890')",
      price: {
        amount: 0.02,
        currency: "USDC",
      },
    },
  ];
  return c.json(resources);
});


app.get("/weather", async (c) => {
  const city = c.req.query("city");
  console.log("City", city);
  const url = `http://api.weatherapi.com/v1/forecast.json?key=${process.env.WEATHER_API_KEY}&q=${city}&days=7`;

  const response = await fetch(url);
  const data = await response.json();
  console.log("Weather API URL:", url);
  console.log("Fetched data:", data);

  return c.json(data);
});


app.get("/car-report", async (c) => {
  const vin = c.req.query("vin");
  if (!vin) {
    return c.json({ error: "VIN number is required" }, 400);
  }
  const url = `${carReportApi}${slug}?vin=${vin}`;
  const response = await fetch(url);
  console.log("Car Report API URL:", url);
  const data = await response.json();
  const carReport = data.data;
  return c.json(carReport);
});

console.log(`Resource running on port ${port}`);

serve({
  port: port,
  fetch: app.fetch,
});
