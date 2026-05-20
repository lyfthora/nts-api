import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { config } from "./env";
import { authService } from "../services/authService";

passport.use(
  new GitHubStrategy(
    {
      clientID: config.githubClientId,
      clientSecret: config.githubClientSecret,
      callbackURL: config.githubCallbackUrl,
      scope: ["user:email"],
    },
    async (
      _accessToken: string,
      _refreshToken: string,
      profile: any,
      done: (err: any, user?: any) => void
    ) => {
      try {
        const email =
        profile.emails?.[0]?.value || `${profile.id}@github.noreply.com`;
        const result = await authService.findOrCreateOAuthUser({
          email,
          name: profile.displayName || profile.username || null,
          provider: "github",
          providerId: String(profile.id),
        });
        done(null, result);
      } catch (err){
        done(err);
      }
    }
  )
);
export default passport;
