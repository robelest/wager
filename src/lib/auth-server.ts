import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

export const { handler, getToken, fetchAuthQuery, fetchAuthMutation, fetchAuthAction } =
  convexBetterAuthReactStart({
    convexUrl: process.env.PUBLIC_CONVEX_URL!,
    convexSiteUrl: process.env.PUBLIC_CONVEX_SITE_URL!,
  });
