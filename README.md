# Prerequisites

- Installed [Node.js](https://nodejs.org/en/) and npm
- Installed and configured [Docker](https://www.docker.com/)
- Existing repository on [Github](https://github.com)
- Configured droplet on [DigitalOcean](https://www.digitalocean.com/)

# Introduction

## What are Github Actions?

GitHub Actions is an API for cause and effect on GitHub: orchestrate any workflow, based on any event, while GitHub manages the execution, provides rich feedback and secures every step along the way.

## What is Docker?

Docker is an open platform for developing, shipping, and running applications. Docker enables you to separate your applications from your infrastructure so you can deliver software quickly. With Docker, you can manage your infrastructure in the same ways you manage your applications.

## What is DigitalOcean Droplet?

DigitalOcean Droplets are Linux-based virtual machines (VMs) that run on top of virtualized hardware. Each Droplet you create is a new server you can use, either standalone or as part of a larger, cloud-based infrastructure.

# Prepare our Node.js application

## Install dependencies

First of all, we need to create a `package.json` file.

The `package.json` file defines the dependencies that should be installed with your application. To create a package.json file for your app, run the command npm init in the root directory of your app. It will walk you through creating a package.json file. You can skip any of the prompts by leaving them blank.

```sh
$ cd path-to-your-repo
$ npm init
```

```
...
name: (nodejs-deploy)
version: (1.0.0)
description: Node.js on DO using Docker and Github Actions
entry point: (server.js)
test command:
git repository:
keywords:
author: First Last <first.last@example.com>
license: (ISC) MIT
...
```

The generated package.json file looks like this:

```JSON
{
  "name": "nodejs-deploy",
  "version": "1.0.0",
  "description": "Node.js on DO using Docker and Github Actions",
  "author": "First Last <first.last@example.com>",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  }
}
```

To install dependencies, use `npm install <pkg>`. It installs the package and also adds it as a dependency in the `package.json` file. For example, to install `express`, you would type `npm install express`.

```sh
$ npm install express
```

Now your `package.json` file should look like this:

```JSON
{
  "name": "nodejs-deploy",
  "version": "1.0.0",
  "description": "Node.js on DO using Docker and Github Actions",
  "author": "First Last <first.last@example.com>",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.17.1"
  }
}

```

## Create `server.js` file

As you may see, we declared that our entry point is a `server.js` file. Let's create one.

This file would contain an `express` application with one simple `GET` endpoint, which would allow us to test deployment.

First of all, let's import `express` and declare our endpoint:

```javascript
'use strict';

const express = require('express');

const PORT = 8080;
const HOST = '0.0.0.0';

const app = express();
app.get('/', (_, res) => {
  res.send({
    message: "It's on Digitalocean!",
  });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`Running on http://${HOST}:${PORT}`);
});
```

Now we can run our application and test if it works. To do this - type `npm start` or `node server.js` in your terminal.

```console
$ npm start
```

```console
Running on http://0.0.0.0:8080
```

Now let's check if our application is listening for requests by accessing http://localhost:8080. I'll use [Postman](https://www.postman.com/) for this.

And it works!

![Postman screenshot](./assets/postman-response.png 'Postman Screenshot')

Now we can proceed to dockerizing our application.

# Dockerize Node.js app

To achieve our goal, first of all we need to create the `Dockerfile`. According to the documentation a Dockerfile is a text document that contains all the commands a user could call on the command line to assemble an image.

## Simple Dockerfile

```Dockerfile
FROM node

# Create app directory
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm install
CMD "npm" "start"
```

You can already build and run your container and it will work, but maybe we can do it better? Of course!

Let's specify version of base image:

```Dockerfile
FROM node:14-alpine
```

Then let's take a look to the dependency installation. We're preparing production build of application, so we don't need dev dependencies to be installed. We can fix it by changing `RUN npm install` to:

```Dockerfile
# Install only production dependencies from lock file
RUN npm ci --only=production
```

Another step is to ensure that all frameworks and libraries are using optimal configuration for production. We can do it by adding this line to our `Dockerfile`:

```Dockerfile
# Optimise for production
ENV NODE_ENV production
```

## [Don’t run containers as root](https://medium.com/@mccode/processes-in-containers-should-not-run-as-root-2feae3f0df3b#:~:text=Containers%20are%20not%20trust%20boundaries,a%20container%20on%20your%20server.)

It's really important to keep your process without security risks! **friends don’t let friends run containers as root!**

So, let's change few more lines in our `Dockerfile`:

```Dockerfile
# Copy app files with permissions for node user
COPY --chown=node:node . /usr/src/app

# friends don’t let friends run containers as root!
USER node
```

Our application is listening on port 8080, so we need to expose this port from the container:

```Dockerfile
EXPOSE 8080
```

At this point our `Dockerfile` looks like this:

```Dockerfile
FROM node:14-alpine

# Optimise for production
ENV NODE_ENV production

# Create app directory
WORKDIR /usr/src/app

# Copy app files
COPY --chown=node:node . /usr/src/app

# Install only production dependencies
RUN npm ci --only=production

# friends don’t let friends run containers as root!
USER node

# Make port 8080 accessible outside of container
EXPOSE 8080
CMD "npm" "start"
```

Let's build and run our image:

```sh
$ docker build . -t nodejs-deploy
$ docker run -d -p 8080:8080 --name=nodejs-deploy nodejs-deploy:latest
```

You can check if it's running by typyng the command:

```sh
$ docker ps
```

And you can see container's logs with the following command:

```sh
$ docker logs nodejs-deploy
```

## Graceful Shutdown

Node.js has integrated web server capabilities. Plus, with Express, these can be extended even more.

Unfortunately, Node.js does not handle shutting itself down very nicely out of the box. This causes many issues with containerized systems.

When a Node.js application receives an interrupt signal, also known as `SIGINT`, or `CTRL+C`, it will cause an abrupt process kill, unless any event handlers were set, of course, to handle it in different behavior. This means that connected clients to a web application will be immediately disconnected.

Let's simulate this problem by creating another endpoint with delayed response:

```javascript
app.get('/delayed', async (_, res) => {
  const SECONDS_DELAY = 60000;

  await new Promise((resolve) => {
    setTimeout(() => resolve(), SECONDS_DELAY);
  });

  res.send({ message: 'delayed response' });
});
```

Run this application and once it’s running send a simple HTTP request to this endpoint.

Hit `CTRL+C` in the running Node.js console window and you’ll see that the curl request exited abruptly. This simulates the same experience your users would receive when containers tear down.

### Part 1

To fix this we need to allow requests to be finished. Let's explain it to our Node.js server:

```javascript
// Graceful shutdown
function closeGracefully(signal) {
  console.log(`Received signal to terminate: ${signal}`);

  server.close(() => {
    // await db.close() if we have a db connection in this app
    // await other things we should cleanup nicely
    console.log('Http server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);
```

This basically calls `server.close()`, which will instruct the Node.js HTTP server to:

- Not accept any more requests.
- Finish all running requests.

It will do this on `SIGINT` (when you press `CTRL+C`) or on `SIGTERM` (the standard signal for a process to terminate).

You may have a question "What if a request is taking too much time?". So if the container is not stopped, Docker and Kubernetes will run a `SIGKILL` after a couple of seconds (usually 30) which cannot be handled by the process itself, so this is not a concern for us.

### Part 2

Now in our `Dockerfile` we're starting our application with the command `npm start`. Unfortunately there is a big problem with this:

If `yarn` or `npm` get a `SIGINT` or `SIGTERM` signal, they correctly forward the signal to spawned child process (in this case `node server.js`). However, it does not wait for the child processes to stop. Instead, `yarn`/`npm` immediately stop themselves.

The solution is not to run application using npm and instead use `node` directly:

```Dockerfile
CMD ["node", "server.js"]
```

But there still is a problem. Docker is running our process as `PID 1`. According to [Node.js Docker Workgroup Recomendations](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#handling-kernel-signals):

> Node.js was not designed to run as PID 1 which leads to unexpected behaviour when running inside of Docker. For example, a Node.js process running as PID 1 will not respond to `SIGINT` (`CTRL-C`) and similar signals.

We can use a tool called `dumb-init` to fix it. It'll be invoked as `PID 1` and then will spawn our node.js process as another process. Let's add to our `Dockerfile`:

```Dockerfile
# Add tool which will fix init process
RUN apk add dumb-init
...
CMD ["dumb-init", "node", "server.js" ]
```

So the final version of our `Dockerfile` looks like this:

```Dockerfile
FROM node:14-alpine

# Add tool which will fix init process
RUN apk add dumb-init

# Optimise for production
ENV NODE_ENV production

# Create app directory
WORKDIR /usr/src/app

# Copy app files
COPY --chown=node:node . /usr/src/app

# Install only production dependencies
RUN npm ci --only=production

# friends don’t let friends run containers as root!
USER node

# Make port 8080 accessible outside of container
EXPOSE 8080
CMD ["dumb-init", "node", "server.js" ]
```

And now we can proceed to our Github Actions!

# Configure the Github Actions

TODO write this part of the article
