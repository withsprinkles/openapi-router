# @withsprinkles/openapi-router

OpenAPI-documented routing built on [`@remix-run/fetch-router`](https://github.com/remix-run/remix/tree/main/packages/fetch-router) and [`@hono/zod-openapi`](https://github.com/honojs/middleware/tree/main/packages/zod-openapi). Define type-safe API routes with automatic OpenAPI documentation generation.

## Features

- **OpenAPI Documentation**: Automatically generate OpenAPI 3.0 specifications from your route definitions
- **Type-Safe Routing**: Full TypeScript support with Zod schema validation for requests and responses
- **Fetch Router Integration**: Built on the composable routing patterns of `@remix-run/fetch-router`
- **Schema Validation**: Leverage Zod for runtime validation of parameters, query strings, headers, and request bodies
- **Standards-Based**: Uses web standards that work across runtimes - Node.js, Bun, Deno, Cloudflare Workers

## Goals

- **Developer Experience**: Write your API once, get type safety and OpenAPI documentation automatically
- **Composability**: Combine the composable routing of fetch-router with OpenAPI documentation
- **Type Safety**: Leverage TypeScript and Zod for end-to-end type safety from routes to responses

## Installation

```sh
# Install with npm
npm add @withsprinkles/openapi-router
```

```sh
# Install with yarn
yarn add @withsprinkles/openapi-router
```

```sh
# Install with pnpm
pnpm add @withsprinkles/openapi-router
```

```sh
# Install with Deno
deno add npm:@withsprinkles/openapi-router
```

```sh
# Install with Bun
bun add @withsprinkles/openapi-router
```

## Usage

The router combines the declarative route maps from `fetch-router` with OpenAPI specifications. Define your routes, create OpenAPI specs with Zod schemas, and get automatic validation and documentation.

```ts
import { createRouter, createSpec, createRoutes, json, z } from "@withsprinkles/openapi-router";

// Create your route map using the familiar fetch-router pattern
const routes = createRoutes({
    users: {
        list: "/users?page&limit",
        show: "/users/:id",
        create: "/users",
    },
});

// Define Zod schemas for validation
const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
    age: z.number(),
});

const CreateUserSchema = UserSchema.omit({ id: true });

// Create OpenAPI specs for each route
const specs = {
    users: {
        list: createSpec(routes.users.list, {
            request: {
                searchParams: z.object({
                    page: z.string().optional(),
                    limit: z.string().optional(),
                }),
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: z.array(UserSchema),
                        },
                    },
                    description: "List of users",
                },
            },
        }),
        show: createSpec(routes.users.show, {
            request: {
                params: z.object({
                    id: z.string(),
                }),
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: UserSchema,
                        },
                    },
                    description: "User details",
                },
                404: {
                    description: "User not found",
                },
            },
        }),
        create: createSpec(routes.users.create, {
            request: {
                body: {
                    content: {
                        "application/json": {
                            schema: CreateUserSchema,
                        },
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: UserSchema,
                        },
                    },
                    description: "User created",
                },
            },
        }),
    },
};

// Create the router
const router = createRouter();

// Map specs to handlers - parameters are fully typed!
router.map(specs.users.list, ({ searchParams }) => {
    // searchParams is typed as { page?: string, limit?: string }
    const page = searchParams?.page || "1";
    const limit = searchParams?.limit || "10";

    return json([
        { id: "1", name: "Alice", email: "alice@example.com", age: 30 },
        { id: "2", name: "Bob", email: "bob@example.com", age: 25 },
    ]);
});

router.map(specs.users.show, ({ params }) => {
    // params is typed as { id: string }
    return json({
        id: params.id,
        name: "Alice",
        email: "alice@example.com",
        age: 30,
    });
});

router.map(specs.users.create, ({ body }) => {
    // body is typed as { name: string, email: string, age: number }
    if (!body) {
        return new Response("Bad Request", { status: 400 });
    }

    return json(
        {
            id: "new-user-id",
            ...body,
        },
        201,
    );
});

// Generate OpenAPI documentation
const openApiDoc = router.getOpenAPIDocument({
    openapi: "3.0.0",
    info: {
        version: "1.0.0",
        title: "My API",
        description: "A type-safe API with automatic OpenAPI documentation",
    },
});

console.log(JSON.stringify(openApiDoc, null, 2));
```

### Route Pattern Conversion

The router automatically converts fetch-router patterns (`:param`) to OpenAPI patterns (`{param}`):

```ts
import { toOpenApiPath } from "@withsprinkles/openapi-router";

toOpenApiPath("/users/:id"); // "/users/{id}"
toOpenApiPath("/users/:userId/posts/:postId"); // "/users/{userId}/posts/{postId}"
toOpenApiPath("/users?page&limit"); // "/users" (search params are stripped)
```

### Type Safety

The router provides full type safety throughout your API:

```ts
const routes = createRoutes({
    posts: {
        show: "/posts/:id",
    },
});

const PostSchema = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    published: z.boolean(),
});

const specs = {
    posts: {
        show: createSpec(routes.posts.show, {
            request: {
                params: z.object({
                    id: z.string(),
                }),
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: PostSchema,
                        },
                    },
                    description: "Post details",
                },
            },
        }),
    },
};

router.map(specs.posts.show, ({ params }) => {
    // TypeScript knows params.id is a string
    console.log(params.id.toUpperCase());

    // TypeScript enforces the response matches PostSchema
    return json({
        id: params.id,
        title: "My Post",
        content: "Post content...",
        published: true,
    });
});
```

### Schema Validation

All requests are validated against your Zod schemas before reaching your handler:

```ts
const CreatePostSchema = z.object({
    title: z.string().min(1).max(100),
    content: z.string().min(1),
    published: z.boolean().default(false),
});

const specs = {
    posts: {
        create: createSpec(routes.posts.create, {
            request: {
                body: {
                    content: {
                        "application/json": {
                            schema: CreatePostSchema,
                        },
                    },
                },
            },
            responses: {
                201: {
                    content: {
                        "application/json": {
                            schema: PostSchema,
                        },
                    },
                    description: "Post created",
                },
                400: {
                    description: "Validation error",
                },
            },
        }),
    },
};

router.map(specs.posts.create, ({ body }) => {
    // body is validated and typed - guaranteed to match CreatePostSchema
    // No need for manual validation!

    return json(
        {
            id: crypto.randomUUID(),
            ...body,
        },
        201,
    );
});
```

### Working with Search Parameters

Search parameters are defined using the `searchParams` property (which maps to OpenAPI's `query` parameters):

```ts
const routes = createRoutes({
    search: "/search?q&category&sort",
});

const specs = {
    search: createSpec(routes.search, {
        request: {
            searchParams: z.object({
                q: z.string(),
                category: z.enum(["tech", "news", "sports"]).optional(),
                sort: z.enum(["date", "relevance"]).default("relevance"),
            }),
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: z.object({
                            results: z.array(z.any()),
                            count: z.number(),
                        }),
                    },
                },
                description: "Search results",
            },
        },
    }),
};

router.map(specs.search, ({ searchParams }) => {
    // searchParams is fully typed and validated
    const { q, category, sort } = searchParams;

    // Perform search with validated parameters
    return json({
        results: [],
        count: 0,
    });
});
```

### Request Context

Every handler receives a context object with validated and typed properties:

```ts
router.map(spec, ({ params, searchParams, body, method, url, headers, request }) => {
    // params: Validated and typed path parameters
    // searchParams: Validated and typed search parameters
    // body: Validated and typed JSON request body
    // method: HTTP method `string`
    // url: `URL` object
    // headers: `SuperHeaders` instance from `@remix-run/headers`
    // request: Original `Request` object

    return json({ success: true });
});
```

### Enhanced Schema Definitions

Add metadata to your schemas for richer OpenAPI documentation:

```ts
const UserSchema = z
    .object({
        id: z.string().meta({
            example: "123e4567-e89b-12d3-a456-426614174000",
        }),
        name: z.string().min(1).max(100).meta({
            example: "John Doe",
            description: "User full name",
        }),
        email: z.string().email().meta({
            example: "john@example.com",
        }),
        age: z.number().int().min(0).max(150).meta({
            example: 42,
        }),
    })
    .meta({
        description: "User object",
    });
```

### Integration with Fetch Router Features

You can use all the routing helpers from `@remix-run/fetch-router`:

```ts
import { createRouter, createSpec, resources, z, json } from "@withsprinkles/openapi-router";

// Use resource-based routing
const routes = resources("posts", { only: ["index", "show", "create", "update", "destroy"] });

const PostSchema = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
});

// Create specs for each resource route
const specs = {
    index: createSpec(routes.index, {
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: z.array(PostSchema),
                    },
                },
                description: "List all posts",
            },
        },
    }),
    show: createSpec(routes.show, {
        request: {
            params: z.object({ id: z.string() }),
        },
        responses: {
            200: {
                content: {
                    "application/json": {
                        schema: PostSchema,
                    },
                },
                description: "Show post",
            },
        },
    }),
};

// Map handlers
const router = createRouter();
router.map(specs.index, () => json([]));
router.map(specs.show, ({ params }) => json({ id: params.id, title: "Post", content: "Content" }));
```

### Serving OpenAPI Documentation

Serve your OpenAPI documentation as JSON:

```ts
import { createRouter, createSpec, createRoutes, json, z } from "@withsprinkles/openapi-router";

const router = createRouter();

// Define your routes and specs...

// Add a route to serve the OpenAPI document
router.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
        version: "1.0.0",
        title: "My API",
        description: "API documentation",
    },
});

// Use the router with your server
const response = await router.fetch(new Request("https://api.example.com/openapi.json"));
console.log(await response.json()); // OpenAPI document

// And/or manually generate the OpenAPI document
const doc = router.getOpenAPIDocument({
    openapi: "3.0.0",
    info: {
        version: "1.0.0",
        title: "My API",
        description: "API documentation",
    },
});

await write("./my-api-openapi.json", JSON.stringify(doc, null, 4)); // OpenAPI document
```

### Testing

Testing works just like with `fetch-router` - use standard `fetch()`:

```ts
import { describe, test, expect } from "my-testing-framework";

describe("Users API", () => {
    test("creates a user", async () => {
        const response = await router.fetch("https://api.example.com/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Alice",
                email: "alice@example.com",
                age: 30,
            }),
        });

        expect(response.status).toBe(201);
        const user = await response.json();
        expect(user.name).toBe("Alice");
    });

    test("validates user creation", async () => {
        const response = await router.fetch("https://api.example.com/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "", // Invalid: too short
                email: "not-an-email", // Invalid: not an email
                age: -5, // Invalid: negative
            }),
        });

        expect(response.status).toBe(400);
    });
});
```

## API Reference

### `createRouter()`

Creates a new OpenAPI-enabled router instance.

```ts
const router = createRouter();
```

Returns a `Router` instance with all OpenAPIHono methods plus a `map()` method for registering route handlers.

### `createSpec(route, config)`

Creates an OpenAPI specification for a route.

```ts
const spec = createSpec(routes.users.show, {
    request: {
        params: z.object({ id: z.string() }),
        searchParams: z.object({ include: z.string().optional() }),
        headers: z.object({ "x-api-key": z.string() }),
        body: {
            content: {
                "application/json": {
                    schema: z.object({ name: z.string() }),
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                "application/json": {
                    schema: UserSchema,
                },
            },
            description: "Success",
        },
    },
});
```

### `router.map(spec, handler)`

Registers a handler for an OpenAPI specification.

```ts
router.map(spec, ({ params, searchParams, body, headers, method, url, request }) => {
    return json({ success: true });
});
```

### `json(data, init?)`

Helper function to create type-safe JSON responses which are generic over both their JSON shape and their response code.

```ts
// Simple usage
json({ message: "Hello" });

// With status code
json({ message: "Created" }, 201);

// With full ResponseInit
json(
    { message: "Hello" },
    {
        status: 200,
        headers: { "X-Custom": "value" },
    },
);
```

## Related Work

- [@remix-run/fetch-router](https://github.com/remix-run/remix/tree/main/packages/fetch-router) - The composable router this package builds on
- [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) - OpenAPI integration for Hono
- [@remix-run/response](https://github.com/remix-run/remix/tree/main/packages/response) - Response helpers for HTML, JSON, files, and redirects
- [@remix-run/headers](https://github.com/remix-run/remix/tree/main/packages/headers) - HTTP headers utilities
- [Zod](https://zod.dev) - TypeScript-first schema validation

## License

[MIT](./LICENSE)
