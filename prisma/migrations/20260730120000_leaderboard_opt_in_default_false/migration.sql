-- Privacy by Default: new users are NOT shown on the public leaderboard
-- unless they explicitly opt in. Existing rows keep their current value.
ALTER TABLE "User" ALTER COLUMN "leaderboardOptIn" SET DEFAULT false;
