import * as restate from "@restatedev/restate-sdk";
import { restateTestEnvironment, StartedRestateTestEnv } from "./restate_env";
import { myService } from "../src/myservice";

describe("ExampleService", () => {
  const testEnv = restateTestEnvironment(
    restate.endpoint().bindRouter("myservice", myService)
  );
  let env: StartedRestateTestEnv | undefined;

  beforeAll(async () => {
    env = await testEnv.start();
  }, 10_000);

  afterAll(async () => {
    if (env) {
      await env.stop();
    }
  });

  it("Calling hello should return a nice greeting", async () => {
    const greeting = await env?.call("myservice", "hello", { name: "bob" });

    expect(greeting).toBe("Hello bob!");
  });

  it("Find the first product in the cart", async () => {
    type handler = (typeof myService)["firstProductInCart"];

    const x = await env?.call<unknown, ReturnType<handler>>(
      "myservice",
      "firstProductInCart",
      { cartId: "1" }
    );

    expect(x?.description).toBe(
      "2021 Custom Winter Fall Zebra Knit Crop Top Women Sweaters Wool Mohair Cos Customize Crew Neck Women' S Crop Top Sweater"
    );
  });

  it("Demo the sleepy handler", async () => {
    type handler = (typeof myService)["sleepyHandler"];

    await env?.call<unknown, ReturnType<handler>>(
      "myservice",
      "sleepyHandler",
      { duration: 10, times: 3 }
    );
  });
});
