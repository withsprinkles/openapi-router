import { describe, expect, expectTypeOf, test } from "bun:test";
import type { MiddlewareHandler } from "hono/types";
import {
    createRouter,
    createRoutes,
    createSpec,
    json,
    type ToOpenApiPath,
    toOpenApiMethod,
    toOpenApiPath,
    z,
} from "./openapi-router.ts";
import type { Router } from "./types.ts";

describe("toOpenApiPath", () => {
    test("converts simple path parameter", () => {
        const result = toOpenApiPath("/users/:id");
        expect(result).toBe("/users/{id}");
    });

    test("converts multiple path parameters", () => {
        const result = toOpenApiPath("/users/:userId/posts/:postId");
        expect(result).toBe("/users/{userId}/posts/{postId}");
    });

    test("handles path with no parameters", () => {
        const result = toOpenApiPath("/users");
        expect(result).toBe("/users");
    });

    test("handles path with trailing slash", () => {
        const result = toOpenApiPath("/users/:id/");
        expect(result).toBe("/users/{id}/");
    });

    test("handles complex parameter names", () => {
        const result = toOpenApiPath("/api/:version/users/:user_id");
        expect(result).toBe("/api/{version}/users/{user_id}");
    });

    test("type level: converts path with parameter", () => {
        expectTypeOf<ToOpenApiPath<"/users/:id">>().toEqualTypeOf<"/users/{id}">();
    });

    test("type level: converts multiple parameters", () => {
        expectTypeOf<
            ToOpenApiPath<"/users/:userId/posts/:postId">
        >().toEqualTypeOf<"/users/{userId}/posts/{postId}">();
    });

    test("type level: handles path with no parameters", () => {
        expectTypeOf<ToOpenApiPath<"/users">>().toEqualTypeOf<"/users">();
    });

    test("strips search parameters from path", () => {
        const result = toOpenApiPath("/users?page&limit");
        expect(result).toBe("/users");
    });

    test("strips search parameters and converts path params", () => {
        const result = toOpenApiPath("/users/:id?includeDeleted");
        expect(result).toBe("/users/{id}");
    });

    test("type level: strips search parameters from path", () => {
        expectTypeOf<ToOpenApiPath<"/users?page&limit">>().toEqualTypeOf<"/users">();
    });

    test("type level: strips search parameters and converts path params", () => {
        expectTypeOf<ToOpenApiPath<"/users/:id?includeDeleted">>().toEqualTypeOf<"/users/{id}">();
    });
});

describe("toOpenApiMethod", () => {
    test("converts GET method", () => {
        expect(toOpenApiMethod("GET")).toBe("get");
    });

    test("converts POST method", () => {
        expect(toOpenApiMethod("POST")).toBe("post");
    });

    test("converts PUT method", () => {
        expect(toOpenApiMethod("PUT")).toBe("put");
    });

    test("converts DELETE method", () => {
        expect(toOpenApiMethod("DELETE")).toBe("delete");
    });

    test("converts PATCH method", () => {
        expect(toOpenApiMethod("PATCH")).toBe("patch");
    });

    test("converts ANY to get", () => {
        expect(toOpenApiMethod("ANY")).toBe("get");
    });
});

describe("createSpec", () => {
    test("creates OpenAPI spec from route", () => {
        const routes = createRoutes({
            users: {
                show: "/users/:id",
            },
        });

        const ParamsSchema = z.object({
            id: z.string(),
        });

        const spec = createSpec(routes.users.show, {
            request: {
                params: ParamsSchema,
            },
            responses: {
                200: {
                    description: "Success",
                },
            },
        });

        expect(spec.method).toBe("get");
        expect(spec.path).toBe("/users/{id}");
    });

    test("spec path converts route pattern to OpenAPI format", () => {
        const routes = createRoutes({
            users: {
                posts: "/users/:userId/posts/:postId",
            },
        });

        const spec = createSpec(routes.users.posts, {
            responses: {
                200: {
                    description: "Success",
                },
            },
        });

        expect(spec.path).toBe("/users/{userId}/posts/{postId}");
    });

    test("type level: spec path type is correct", () => {
        const routes = createRoutes({
            users: {
                show: "/users/:id",
            },
        });

        const spec = createSpec(routes.users.show, {
            responses: {
                200: {
                    description: "Success",
                },
            },
        });

        expectTypeOf(spec.path).toEqualTypeOf<"/users/{id}">();
    });
});

describe("createRouter", () => {
    test("creates a router instance", () => {
        const router = createRouter();
        expect(router).toBeDefined();
        expect(router.map).toBeFunction();
    });

    test("router has OpenAPIHono methods", () => {
        const router = createRouter();
        expect(router.get).toBeFunction();
        expect(router.post).toBeFunction();
        expect(router.put).toBeFunction();
        expect(router.delete).toBeFunction();
    });

    test("router.map registers route handler", () => {
        const router = createRouter();
        const routes = createRoutes({
            users: {
                show: "/users/:id",
            },
        });

        const ParamsSchema = z.object({
            id: z.string(),
        });

        const UserSchema = z.object({
            id: z.string(),
            name: z.string(),
        });

        const spec = createSpec(routes.users.show, {
            request: {
                params: ParamsSchema,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: UserSchema,
                        },
                    },
                    description: "User retrieved",
                },
            },
        });

        expect(() => {
            router.map(spec, ({ params }) => {
                return json({
                    id: params.id,
                    name: "Test User",
                });
            });
        }).not.toThrow();
    });

    test("type level: router type is correct", () => {
        const router = createRouter();
        expectTypeOf(router).toExtend<Router>();
    });

    test("creates router with basePath option", () => {
        const router = createRouter({ basePath: "/api" });
        expect(router).toBeDefined();
        expect(router.map).toBeFunction();
    });

    test("creates router with middleware option (single)", () => {
        const mockMiddleware: MiddlewareHandler = async (_c, next) => {
            await next();
        };

        const router = createRouter({ middleware: mockMiddleware });
        expect(router).toBeDefined();
        expect(router.map).toBeFunction();
    });

    test("creates router with middleware option (array)", () => {
        const mockMiddleware1: MiddlewareHandler = async (_c, next) => {
            await next();
        };
        const mockMiddleware2: MiddlewareHandler = async (_c, next) => {
            await next();
        };

        const router = createRouter({ middleware: [mockMiddleware1, mockMiddleware2] });
        expect(router).toBeDefined();
        expect(router.map).toBeFunction();
    });

    test("creates router with both basePath and middleware", () => {
        const mockMiddleware: MiddlewareHandler = async (_c, next) => {
            await next();
        };

        const router = createRouter({
            basePath: "/api",
            middleware: mockMiddleware,
        });
        expect(router).toBeDefined();
        expect(router.map).toBeFunction();
    });
});

describe("json response helper", () => {
    test("creates JSON response", () => {
        const response = json({ message: "Hello" });
        expect(response).toBeInstanceOf(Response);
        expect(response.headers.get("content-type")).toContain("application/json");
    });

    test("creates JSON response with status code", () => {
        const response = json({ message: "Created" }, 201);
        expect(response.status).toBe(201);
    });

    test("creates JSON response with headers", async () => {
        const response = json(
            { message: "Hello" },
            {
                status: 200,
                headers: { "X-Custom-Header": "value" },
            },
        );
        expect(response.headers.get("X-Custom-Header")).toBe("value");
    });

    test("creates JSON response with ResponseInit", () => {
        const response = json(
            { message: "Created" },
            {
                status: 201,
                headers: { "X-Custom": "test" },
            },
        );
        expect(response.status).toBe(201);
        expect(response.headers.get("X-Custom")).toBe("test");
    });

    test("response body contains correct JSON", async () => {
        const data = { id: "123", name: "Test" };
        const response = json(data);
        const body = await response.json();
        expect(body).toEqual(data);
    });
});

describe("type safety and inference", () => {
    test("type level: params are correctly typed", () => {
        const routes = createRoutes({
            users: {
                show: "/users/:id",
            },
        });

        const ParamsSchema = z.object({
            id: z.string(),
        });

        const UserSchema = z.object({
            id: z.string(),
            name: z.string(),
            age: z.number(),
        });

        const spec = createSpec(routes.users.show, {
            request: {
                params: ParamsSchema,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: UserSchema,
                        },
                    },
                    description: "User",
                },
            },
        });

        const router = createRouter();

        router.map(spec, ({ params }) => {
            expectTypeOf(params).toEqualTypeOf<{ id: string }>();
            expectTypeOf(params.id).toBeString();
            return json({
                id: params.id,
                name: "Test",
                age: 25,
            });
        });
    });

    test("type level: search params are correctly typed", () => {
        const routes = createRoutes({
            users: {
                list: "/users?page&limit",
            },
        });

        const SearchParamsSchema = z.object({
            page: z.string().optional(),
            limit: z.string().optional(),
        });

        const spec = createSpec(routes.users.list, {
            request: {
                searchParams: SearchParamsSchema,
            },
            responses: {
                200: {
                    description: "Users list",
                },
            },
        });

        const router = createRouter();

        router.map(spec, ({ searchParams }) => {
            if (searchParams) {
                expectTypeOf(searchParams.page).toEqualTypeOf<string | undefined>();
                expectTypeOf(searchParams.limit).toEqualTypeOf<string | undefined>();
            }
            return json({ users: [] });
        });
    });

    test("type level: request body is correctly typed", () => {
        const routes = createRoutes({
            users: {
                create: "/users",
            },
        });

        const CreateUserSchema = z.object({
            name: z.string(),
            email: z.string().email(),
            age: z.number(),
        });

        const UserSchema = z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            age: z.number(),
        });

        const spec = createSpec(routes.users.create, {
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
        });

        const router = createRouter();

        router.map(spec, ({ body }) => {
            if (body) {
                expectTypeOf(body.name).toBeString();
                expectTypeOf(body.email).toBeString();
                expectTypeOf(body.age).toBeNumber();
            }
            return json(
                {
                    id: "new-id",
                    name: body?.name || "",
                    email: body?.email || "",
                    age: body?.age || 0,
                },
                201,
            );
        });
    });

    test("type level: response type matches schema", () => {
        const routes = createRoutes({
            users: {
                show: "/users/:id",
            },
        });

        const UserSchema = z.object({
            id: z.string(),
            name: z.string(),
            age: z.number(),
        });

        const spec = createSpec(routes.users.show, {
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: UserSchema,
                        },
                    },
                    description: "User",
                },
            },
        });

        const router = createRouter();

        router.map(spec, () => {
            const response = json(
                {
                    id: "123",
                    name: "John",
                    age: 30,
                },
                { status: 200 },
            );
            return response;
        });

        router.map(spec, () => {
            return json({
                id: "123",
                name: "John",
                age: 30,
            });
        });
    });
});

describe("complex scenarios", () => {
    test("handles route with multiple param types", () => {
        const routes = createRoutes({
            api: {
                userPosts: "/api/:version/users/:userId/posts/:postId",
            },
        });

        const ParamsSchema = z.object({
            version: z.string(),
            userId: z.string(),
            postId: z.string(),
        });

        const spec = createSpec(routes.api.userPosts, {
            request: {
                params: ParamsSchema,
            },
            responses: {
                200: {
                    description: "Success",
                },
            },
        });

        expect(spec.path).toBe("/api/{version}/users/{userId}/posts/{postId}");
    });

    test("handles schemas with metadata", () => {
        const ParamsSchema = z.object({
            id: z
                .string()
                .min(3)
                .meta({
                    param: {
                        name: "id",
                        in: "path",
                    },
                    example: "1212121",
                }),
        });

        const UserSchema = z
            .object({
                id: z.string().meta({ example: "123" }),
                name: z.string().meta({ example: "John Doe" }),
                age: z.number().meta({ example: 42 }),
            })
            .meta({ description: "User" });

        const routes = createRoutes({
            users: {
                show: "/users/:id",
            },
        });

        const spec = createSpec(routes.users.show, {
            request: {
                params: ParamsSchema,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: UserSchema,
                        },
                    },
                    description: "Retrieve the user",
                },
            },
        });

        expect(spec.request?.params).toBeDefined();
        expect(spec.responses[200]).toBeDefined();
    });

    test("handles nested route definitions", () => {
        const routes = createRoutes({
            api: {
                v1: {
                    users: {
                        list: "/api/v1/users",
                        show: "/api/v1/users/:id",
                    },
                },
            },
        });

        expect(routes.api.v1.users.list.pattern.source).toBe("/api/v1/users");
        expect(routes.api.v1.users.show.pattern.source).toBe("/api/v1/users/:id");
    });

    test("route href works with nested routes", () => {
        const routes = createRoutes({
            api: {
                v1: {
                    users: {
                        show: "/api/v1/users/:id",
                    },
                },
            },
        });

        const url = routes.api.v1.users.show.href({ id: "user123" });
        expect(url).toBe("/api/v1/users/user123");
    });
});

describe("OpenAPI document generation", () => {
    test("router can generate OpenAPI document", () => {
        const router = createRouter();
        const routes = createRoutes({
            users: {
                show: "/users/:id",
            },
        });

        const ParamsSchema = z.object({
            id: z.string(),
        });

        const UserSchema = z.object({
            id: z.string(),
            name: z.string(),
        });

        const spec = createSpec(routes.users.show, {
            request: {
                params: ParamsSchema,
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: UserSchema,
                        },
                    },
                    description: "User",
                },
            },
        });

        router.map(spec, ({ params }) => {
            return json({
                id: params.id,
                name: "Test User",
            });
        });

        const config = {
            openapi: "3.0.0",
            info: {
                version: "1.0.0",
                title: "Test API",
            },
        };

        const doc = router.getOpenAPIDocument(config);

        expect(doc).toBeDefined();
        expect(doc.openapi).toBe("3.0.0");
        expect(doc.info.title).toBe("Test API");
        expect(doc.info.version).toBe("1.0.0");
    });

    test("generated OpenAPI doc includes registered routes", () => {
        const router = createRouter();
        const routes = createRoutes({
            users: {
                list: "/users?page&limit",
                show: "/users/:id",
            },
        });

        const UserSchema = z.object({
            id: z.string(),
            name: z.string(),
        });

        const listSpec = createSpec(routes.users.list, {
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
                    description: "Users list",
                },
            },
        });

        const showSpec = createSpec(routes.users.show, {
            request: {
                params: z.object({ id: z.string() }),
            },
            responses: {
                200: {
                    content: {
                        "application/json": {
                            schema: UserSchema,
                        },
                    },
                    description: "User",
                },
            },
        });

        router.map(listSpec, () => json([]));
        router.map(showSpec, ({ params }) => json({ id: params.id, name: "User" }));

        const doc = router.getOpenAPIDocument({
            openapi: "3.0.0",
            info: {
                version: "1.0.0",
                title: "Test API",
            },
        });

        expect(doc.paths).toBeDefined();
        // Search params are part of the route pattern but not the OpenAPI path
        // The path should still be /users even with ?page&limit in the pattern
        const pathKeys = Object.keys(doc.paths);
        expect(pathKeys).toContain("/users");
        expect(pathKeys).toContain("/users/{id}");
    });
});
