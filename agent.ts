/** Dynamic Agent
 * Example of an agent that has dynamic, discoverable tools, enabled by x402 payments.
 */
import axios from "axios";
import { withPaymentInterceptor } from "x402-axios";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { http, publicActions, createWalletClient } from "viem";
import { Hex } from "viem";
import { agent, tool, OpenAI } from "llamaindex";
import { z } from "zod";

const wallet = createWalletClient({
  chain: baseSepolia,
  transport: http(),
  account: privateKeyToAccount(process.env.PRIVATE_KEY as Hex),
}).extend(publicActions);

const axiosWithPayment = withPaymentInterceptor(axios.create({}), wallet);

const llm = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-mini",
});

const indexTool = tool(
  async () => {
    const response = await axiosWithPayment.get("http://localhost:4021/");
    const data = await response.data;
    console.log("Available Resources:", data);
    return data;
  },
  {
    name: "api-index",
    description:
      "Returns to you a list of all the APIs available for you to access",
    parameters: z.object({}),
  }
);

const httpTool = tool(
  async ({ url }: { url: string }) => {
    console.log("Step 1: Agent hitting resource to trigger 402:", url);

    const unpaidRes = await axios.get(url, {
      validateStatus: () => true, // so we can handle 402 manually
    });

    if (unpaidRes.status !== 402) {
      throw new Error("Expected 402 Payment Required but got " + unpaidRes.status);
    }
    console.log("Step 1 Response:", unpaidRes.data);

    const accept = unpaidRes.data.accepts?.[0];
    if (!accept) throw new Error("No acceptable payment options returned");

    const paymentPayload = {
      ...accept,
      agentId: process.env.AGENT_ID,
    };
    console.log("Payment Payload:", paymentPayload);

    // Send to your backend
    const backendRes = await axios.post(
      "https://paystabl-dev.replit.app/agents/payment/process",
      paymentPayload,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Step 2 Response: x-payment: ", backendRes.data);

    const { xPaymentHeader } = backendRes.data;

    if (!xPaymentHeader) throw new Error("Missing xPaymentHeader in backend response");

    // Step 3: Retry the same URL with X-Payment
    console.log("Retrying URL with X-Payment Header...");
    console.log("URL:", url);
    console.log("X-Payment:", xPaymentHeader);

    const finalRes = await axios.get(url, {
      headers: {
        "X-Payment": xPaymentHeader,
        "Content-Type": "application/json",
      },
    });
    console.log("Step 3 Code: ", finalRes.status);
    console.log("Step 3 Response:", finalRes.data);
    return finalRes.data;
  },
  {
    name: "make-paid-request",
    description: "Triggers payment and fetches paid data via x402 flow",
    parameters: z.object({
      url: z.string({ description: "The paid endpoint URL (e.g. https://api.com/data)" }),
    }),
  }
);
const bot = agent({
  llm,
  tools: [indexTool, httpTool],
  timeout: 100000,
});

const response = await bot.run(`
  You are a helpful assistant with access to paid APIs.
  First, use the "api-index" tool to discover what APIs are available.
  Then, use the "make-paid-request" tool to call the relevant URLs based on what you find.
  
  Your goal: Make a pun based on the weather in Pune
`);

console.log(response);
