import * as restate from "@restatedev/restate-sdk";

import {
  GenericContainer,
  StartedTestContainer,
  TestContainers,
  Wait,
} from "testcontainers";
import * as http2 from "http2";
import * as net from "net";

export interface RouterConf {
  routers?: Record<string, restate.UnKeyedRouter<any>>;
  keyedRouters?: Record<string, restate.KeyedRouter<any>>;
}

export interface RestateTestEnv {
  start(): Promise<StartedRestateTestEnv>;
}

export type FirstArgument<T extends (...args: any[]) => any> = T extends (
  arg1: infer U,
  ...args: any[]
) => any
  ? U
  : never;

export type SecondArgument<T extends (...args: any[]) => any> = T extends (
  arg1: string,
  arg2: infer U,
  ...args: any[]
) => any
  ? U
  : never;

export interface StartedRestateTestEnv {
  baseUrl: string;
  adminAPIBaseUrl: string;
  call<H extends (input: any) => Promise<any>>(
    service: string,
    handler: string,
    request: FirstArgument<H>
  ): Promise<ReturnType<H>>;
  keyedCall<H extends (key: string, input: any) => Promise<any>>(
    service: string,
    handler: string,
    key: string,
    request: SecondArgument<H>
  ): Promise<ReturnType<H>>;

  stop(): Promise<void>;
}

export const restateTestEnvironment = (routers: RouterConf): RestateTestEnv => {
  return {
    async start(): Promise<StartedRestateTestEnv> {
      const endpoint = restate.endpoint();
      for (const [key, router] of Object.entries(routers.routers ?? {})) {
        endpoint.bindRouter(key, router);
      }
      for (const [key, router] of Object.entries(routers.keyedRouters ?? {})) {
        endpoint.bindKeyedRouter(key, router);
      }
      let endpointServer = await serveEndpoint(endpoint);
      let restateServer = await serveRuntime(
        (endpointServer.address() as net.AddressInfo).port
      );
      const baseUrl = `http://${restateServer.getHost()}:${restateServer.getMappedPort(
        8080
      )}`;
      const adminAPIBaseUrl = `http://${restateServer.getHost()}:${restateServer.getMappedPort(
        9070
      )}`;

      return {
        baseUrl,
        adminAPIBaseUrl,

        call: async <H extends (input: any) => Promise<any>>(
          service: string,
          handler: string,
          request: FirstArgument<H>
        ): Promise<ReturnType<H>> => {
          const url = `${baseUrl}/${service}/${handler}`;
          const requestBody = { request };
          return doCall<ReturnType<H>>(url, requestBody);
        },

        keyedCall: async <H extends (key: string, input: any) => Promise<any>>(
          service: string,
          handler: string,
          key: string,
          request: SecondArgument<H>
        ): Promise<ReturnType<H>> => {
          const url = `${baseUrl}/${service}/${handler}`;
          const requestBody = { key, request };
          return doCall<ReturnType<H>>(url, requestBody);
        },

        stop: async () => {
          await restateServer.stop();
          endpointServer.close();
        },
      };
    },
  };
};

async function doCall<O>(url: string, request: any): Promise<O> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });
  const js = (await res.json()) as { response: O };
  return js.response;
}

async function serveEndpoint(
  endpoint: restate.RestateEndpoint
): Promise<http2.Http2Server> {
  const restateHttpServer = http2.createServer(endpoint.http2Handler());
  await new Promise((resolve, reject) => {
    restateHttpServer
      .listen(0)
      .once("listening", resolve)
      .once("error", reject);
  });
  return restateHttpServer;
}

async function serveRuntime(
  endpointPort: number
): Promise<StartedTestContainer> {
  const containerSpec = new GenericContainer(
    "docker.io/restatedev/restate:latest"
  )
    // Expose ports
    .withExposedPorts(8080, 9070)
    // Wait start on health checks
    .withWaitStrategy(
      Wait.forAll([
        Wait.forHttp("/grpc.health.v1.Health/Check", 8080),
        Wait.forHttp("/health", 9070),
      ])
    );

  // This MUST be executed before starting the restate container
  // Expose host port to access the restate server
  await TestContainers.exposeHostPorts(endpointPort);

  // Start restate container
  const container = await containerSpec.start();

  // From now on, if something fails, stop the container to cleanup the environment
  try {
    console.info("Going to register services");

    // Register this service endpoint
    const res = await fetch(
      `http://${container.getHost()}:${container.getMappedPort(
        9070
      )}/deployments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // See https://node.testcontainers.org/features/networking/#expose-host-ports-to-container
          uri: `http://host.testcontainers.internal:${endpointPort}`,
        }),
      }
    );
    if (!res.ok) {
      const badResponse = await res.text();
      throw new Error(
        `Error ${res.status} during registration: ${badResponse}`
      );
    }

    console.info("Registered");
    return container;
  } catch (e) {
    await container.stop();
    throw e;
  }
}
