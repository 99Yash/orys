import { z } from "zod";

const mutationSchema = z.object({
  id: z.number(),
  clientID: z.string(),
  name: z.string(),
  args: z.unknown(),
});

export const pushRequestSchema = z.object({
  profileID: z.string(),
  clientGroupID: z.string(),
  mutations: z.array(mutationSchema),
  schemaVersion: z.string().optional(),
});

export type PushRequest = z.infer<typeof pushRequestSchema>;
export type Mutation = z.infer<typeof mutationSchema>;

const cookieSchema = z
  .object({
    order: z.number(),
    clientGroupID: z.string(),
  })
  .nullable();

export const pullRequestSchema = z.object({
  profileID: z.string(),
  clientGroupID: z.string(),
  cookie: cookieSchema,
  schemaVersion: z.string().optional(),
});

export type PullRequest = z.infer<typeof pullRequestSchema>;
export type PullCookie = z.infer<typeof cookieSchema>;
