
import * as restate from "@restatedev/restate-sdk";

// Template of a Restate handler that simply echos the request.
//
// The Restate context is the entry point of all interaction with Restate, such as
// - RPCs:         `await ctx.rpc<apiType>({ path: "someService" }).doSomething(key, someData)`
// - messaging:    `ctx.send<apiType>({ path: "someService" }).somethingElse(someData)`
// - state:        `await ctx.get<string>("myState")`
// - side-effects: `await ctx.sideEffect(() => { runExternalStuff() })`
// - timers:       `await ctx.sendDelayed<apiType>({ path: "someService" }, 100_000).somethingElse(someData)`
// - etc.
//
// Have a look at the TS docs on the context, or at https://docs.restate.dev/
//


export const myService = restate.router({

  /**
   * Hello handler - a simple hello world restate handler.
   *  
   * Try it out (check out app.ts first on how to start the server):
   * 
   * curl -X POST -H 'content-type: application/json' http://localhost:8080/myservice/hello -d '{ "request": { "name" : "Bob" } }'
   * 
   * 
   * @param ctx restate context. 
   * @param request the contents of the request's payload
   * @returns a personalized, durable, greeting.
   */
  hello: async (_ctx: restate.Context, request: {name: string}) => {
    return `Hello ${request.name}!`;
  },

  /**
   * FirstProductInCart - this handler demonstrates how to use sideEffects. 
   * 
   * This handler fetches the content of a shopping cart with a given cartId,
   * and then fetches the first product's description that was in that cart.
   * 
   * Try it out (check out app.ts first on how to start the server):
   * 
   * curl -X POST -H 'content-type: application/json' http://localhost:8080/myservice/firstProductInCart -d '{ "request": { "cartId": "1"} }'
   * 
   * @param ctx restate context. 
   * @param request 
   * @returns a description of the first product in the cart
   */
  firstProductInCart: async (ctx: restate.Context, request: { cartId: string }) => {

    const cart = await ctx.sideEffect(async () => {
      //
      // fetch the cart contents within the sideEffect.
      //
      const res = await fetch(`https://dummyjson.com/carts/${request.cartId}`);
      return (await res.json()) as {
        products: Array<{id: string}>
      };
    });

    //
    // At this point, we can use `cart` reliably, even if at this point our handler will crash,
    // Restate had journald the fact that this sideEffect was previously successful with the result durably stored.
    //

    //
    // now let's fetch the description of the first item in the cart.
    //
    const firstProduct = cart.products.pop();
    if (!firstProduct) {
      return {};
    }

    const product = await ctx.sideEffect(async () => {
      //
      // fetch the product description within the sideEffect.
      //
      const res = await fetch(`https://dummyjson.com/products/${firstProduct.id}`);
      return (await res.json()) as {
        id: string;
        description: string;
        thumbnail: string;
      };
    });
   
    return {description: product.description}
  },

  /**
   * SleepyHandler - demonstrates how to use ctx.sleep
   * 
   * Try it out (check out the bottom of this file how to start restate):
   * 
   * curl -X POST -H 'content-type: application/json' http://localhost:8080/myservice/sleepyHandler -d '{ "request": { "duration": 1000, "times" : 3} }'
   * 
   * 
   * @param ctx the restate context 
   * @param request how many times to sleep and for how long to sleep. 
   */
  sleepyHandler: async (ctx: restate.Context, request: { duration: number, times: number }) => {

    for (let i = 0 ; i < request.times ; i++) {
      ctx.console.log(`About to sleep at the ${i}-th time. Zzz....`);
      await ctx.sleep(request.duration);
      ctx.console.log(`Done sleeping!`);
    }

    return `slept for a total of ${ request.duration * request.times } milliseconds`
  },

});
