import * as restate from "@restatedev/restate-sdk";
import { myService } from "./myservice";


// Create the Restate server to accept requests
restate
  .endpoint()
  .bindRouter(
    "myservice", // the name of the service that serves the handlers
    myService // the routes and handlers in the service
  )
  .listen(9080);

// --------------
//  Testing this
// --------------
//
// To launch Restate and register this service (if you don't have Restate running already)
//
//  - On macOS:
//    docker run --name restate_dev --rm -p 8080:8080 -p 9070:9070 -p 9071:9071 docker.io/restatedev/restate:latest
//    curl -X POST http://localhost:9070/deployments -H 'content-type: application/json' -d '{"uri": "http://host.docker.internal:9080"}'
//
//  - On Linux:
//    docker run --name restate_dev --rm --network=host docker.io/restatedev/restate:latest
//    curl -X POST http://localhost:9070/deployments -H 'content-type: application/json' -d '{"uri": "http://localhost:9080"}'
//
